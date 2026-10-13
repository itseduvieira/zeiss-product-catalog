namespace ProductCatalog.Api.Domain;

public class NotFoundException : Exception
{
    public NotFoundException(string message) : base(message)
    {
    }
}

public class ConflictException : Exception
{
    public ConflictException(string message) : base(message)
    {
    }
}

public class ProductIdExhaustedException : Exception
{
    public ProductIdExhaustedException(string message) : base(message)
    {
    }
}

public class ValidationFailedException : Exception
{
    public ValidationFailedException(IReadOnlyDictionary<string, string[]> errors)
        : base("One or more fields are invalid.")
    {
        Errors = errors;
    }

    public ValidationFailedException(string field, string message)
        : this(new Dictionary<string, string[]>
        {
            [field] = [message]
        })
    {
    }

    public IReadOnlyDictionary<string, string[]> Errors { get; }
}
