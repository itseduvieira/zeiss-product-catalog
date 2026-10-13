using FluentValidation;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Validation;

public sealed class UpdateProductRequestValidator : AbstractValidator<UpdateProductRequest>
{
    public UpdateProductRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(name => !string.IsNullOrWhiteSpace(name))
            .WithMessage("Name is required.")
            .MaximumLength(ProductRules.NameMaxLength);

        RuleFor(x => x.Description)
            .MaximumLength(ProductRules.DescriptionMaxLength)
            .When(x => x.Description is not null);

        RuleFor(x => x.Price)
            .GreaterThan(0).WithMessage("Price has to be greater than zero.")
            .LessThanOrEqualTo(ProductRules.MaxPrice)
            .Must(price => decimal.Round(price, 2) == price)
            .WithMessage("Price cannot have more than 2 decimal places.");

        RuleFor(x => x.Stock)
            .GreaterThanOrEqualTo(0).WithMessage("Stock cannot be negative.")
            .LessThanOrEqualTo(ProductRules.MaxStock);

        RuleFor(x => x.CategoryId)
            .GreaterThan(0)
            .WithMessage("Category is required.");
    }
}
