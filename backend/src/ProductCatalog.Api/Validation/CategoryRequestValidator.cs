using FluentValidation;
using ProductCatalog.Api.Contracts;
using ProductCatalog.Api.Domain;

namespace ProductCatalog.Api.Validation;

public sealed class CategoryRequestValidator : AbstractValidator<CategoryRequest>
{
    public CategoryRequestValidator()
    {
        RuleFor(x => x.Name)
            .Must(name => !string.IsNullOrWhiteSpace(name))
            .WithMessage("Name is required.")
            .MaximumLength(CategoryRules.NameMaxLength);

        RuleFor(x => x.Description)
            .MaximumLength(CategoryRules.DescriptionMaxLength)
            .When(x => x.Description is not null);
    }
}
