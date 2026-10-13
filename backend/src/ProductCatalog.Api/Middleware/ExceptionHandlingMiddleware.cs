using System.Text.Json;
using Microsoft.AspNetCore.Mvc;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Middleware;

public sealed class ExceptionHandlingMiddleware
{
    private static readonly JsonNamingPolicy CamelCase = JsonNamingPolicy.CamelCase;
    private static readonly JsonSerializerOptions JsonOptions = new(JsonSerializerDefaults.Web);

    private readonly RequestDelegate _next;
    private readonly ILogger<ExceptionHandlingMiddleware> _logger;
    private readonly IHostEnvironment _environment;

    public ExceptionHandlingMiddleware(
        RequestDelegate next,
        ILogger<ExceptionHandlingMiddleware> logger,
        IHostEnvironment environment)
    {
        _next = next;
        _logger = logger;
        _environment = environment;
    }

    public async Task InvokeAsync(HttpContext context)
    {
        try
        {
            await _next(context);
        }
        catch (OperationCanceledException) when (context.RequestAborted.IsCancellationRequested)
        {
            throw;
        }
        catch (NotFoundException exception)
        {
            await WriteAsync(context, StatusCodes.Status404NotFound, "Not found", exception.Message);
        }
        catch (ConflictException exception)
        {
            _logger.LogWarning("Request conflicted: {Message}", exception.Message);
            await WriteAsync(context, StatusCodes.Status409Conflict, "Conflict", exception.Message);
        }
        catch (ValidationFailedException exception)
        {
            await WriteValidationAsync(context, exception);
        }
        catch (ProductIdExhaustedException exception)
        {
            _logger.LogError(exception, "Product id space is exhausted");
            await WriteAsync(context, StatusCodes.Status503ServiceUnavailable, "Service unavailable", exception.Message);
        }
        catch (Exception exception)
        {
            _logger.LogError(exception, "Unhandled exception on {Method} {Path}", context.Request.Method, context.Request.Path);
            var detail = _environment.IsDevelopment()
                ? exception.Message
                : "An unexpected error occurred.";
            await WriteAsync(context, StatusCodes.Status500InternalServerError, "Server error", detail);
        }
    }

    private static async Task WriteValidationAsync(HttpContext context, ValidationFailedException exception)
    {
        if (context.Response.HasStarted)
            throw exception;

        var errors = exception.Errors.ToDictionary(
            pair => CamelCase.ConvertName(pair.Key),
            pair => pair.Value);

        var problem = new ProblemDetails
        {
            Status = StatusCodes.Status400BadRequest,
            Title = "One or more fields are invalid.",
            Detail = exception.Message,
            Instance = context.Request.Path
        };
        problem.Extensions["errors"] = errors;

        context.Response.StatusCode = StatusCodes.Status400BadRequest;
        context.Response.ContentType = "application/problem+json";
        await JsonSerializer.SerializeAsync(context.Response.Body, problem, JsonOptions);
    }

    private static async Task WriteAsync(HttpContext context, int status, string title, string detail)
    {
        if (context.Response.HasStarted)
            return;

        context.Response.StatusCode = status;
        context.Response.ContentType = "application/problem+json";
        await JsonSerializer.SerializeAsync(context.Response.Body, new ProblemDetails
        {
            Status = status,
            Title = title,
            Detail = detail,
            Instance = context.Request.Path
        }, JsonOptions);
    }
}
