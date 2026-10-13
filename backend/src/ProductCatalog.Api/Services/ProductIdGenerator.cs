using System.Globalization;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Storage;
using ProductCatalog.Api.Data;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Services;

public sealed class ProductIdGenerator : IProductIdGenerator
{
    private readonly CatalogDbContext _db;

    public ProductIdGenerator(CatalogDbContext db)
    {
        _db = db;
    }

    public async Task<int> NextAsync(CancellationToken cancellationToken = default)
    {
        var connection = _db.Database.GetDbConnection();
        if (connection.State != System.Data.ConnectionState.Open)
            await connection.OpenAsync(cancellationToken);

        await using var command = connection.CreateCommand();
        command.CommandText =
            """
            UPDATE IdSequences
            SET LastValue = LastValue + 1
            WHERE Name = @name AND LastValue < @max
            RETURNING LastValue;
            """;

        var name = command.CreateParameter();
        name.ParameterName = "@name";
        name.Value = IdSequence.ProductName;
        command.Parameters.Add(name);

        var max = command.CreateParameter();
        max.ParameterName = "@max";
        max.Value = ProductRules.MaxId;
        command.Parameters.Add(max);

        if (_db.Database.CurrentTransaction is { } current)
            command.Transaction = current.GetDbTransaction();

        await using var reader = await command.ExecuteReaderAsync(cancellationToken);
        if (!await reader.ReadAsync(cancellationToken))
        {
            throw new ProductIdExhaustedException(
                "No product ids left in the 6-digit range.");
        }

        var id = Convert.ToInt32(reader.GetValue(0), CultureInfo.InvariantCulture);
        if (id < ProductRules.MinId)
        {
            throw new InvalidOperationException(
                $"Sequence returned {id}, which is below {ProductRules.MinId}. The IdSequences row looks wrong.");
        }

        return id;
    }
}
