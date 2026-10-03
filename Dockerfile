FROM mcr.microsoft.com/dotnet/sdk:10.0 AS build
WORKDIR /src
COPY src/ProductCatalog.Api/ src/ProductCatalog.Api/
RUN dotnet publish src/ProductCatalog.Api/ProductCatalog.Api.csproj \
    -c Release \
    -o /app/publish

FROM mcr.microsoft.com/dotnet/aspnet:10.0 AS final
WORKDIR /app
COPY --from=build /app/publish .

USER root
RUN mkdir -p /data && chown "$APP_UID:$APP_UID" /data
USER $APP_UID

ENV ASPNETCORE_HTTP_PORTS=8080
EXPOSE 8080
ENTRYPOINT ["dotnet", "ProductCatalog.Api.dll"]
