using QuestPDF;
using QuestPDF.Fluent;
using QuestPDF.Helpers;
using QuestPDF.Infrastructure;
using umfg.programacaoiii.minimalapi._2026.DTO;
using umfg.programacaoiii.minimalapi._2026.Entidades;
using umfg.programacaoiii.minimalapi._2026.Repositorio;

namespace umfg.programacaoiii.minimalapi._2026;

public class Program
{
    //método de startup do projeto
    public static void Main(string[] args)
    {
        //variavel padrão do .net permite definir as caracteristicas que a api irá ter
        var builder = WebApplication.CreateBuilder(args);

        // "banco de dados" da aplicação: arquivo JSON local (dados/lembretes.json).
        // Não precisa de MySQL nem Docker: os dados são lidos e gravados nesse arquivo.
        var caminhoDados = Path.Combine(builder.Environment.ContentRootPath, "dados", "lembretes.json");
        builder.Services.AddSingleton(new LembreteRepositorio(caminhoDados));

        //implementacao do CORS para permitir que a aplicação frontend acesse a API (localhost)
        //no mundo real, restrinja o acesso apenas para o dominio do frontend conhecido. Ex.: .WithOrigins("https://app.empresa.com.br")
        builder.Services.AddCors(options =>
        {
            options.AddPolicy("Frontend", policy =>
            {
                policy
                    .AllowAnyOrigin()
                    .AllowAnyHeader()
                    .AllowAnyMethod();
            });
        });

        //aqui a aplicação é construída
        var app = builder.Build();

        // CORS antes de qualquer outro middleware: garante os cabeçalhos também no preflight (OPTIONS)
        app.UseCors("Frontend");

        app.MapPost("/lembretes", async (LembreteDTO dto, LembreteRepositorio repositorio) =>
        {
            var erro = ValidarDescricao(dto.Descricao);

            if (erro is not null)
                return Results.BadRequest(new { mensagem = erro });

            var lembrete = new Lembrete(dto.Descricao.Trim());

            await repositorio.AdicionarAsync(lembrete);

            return Results.Created($"/lembretes/{lembrete.Id}", lembrete);
        });

        app.MapGet("/lembretes/{id}", async (string id, LembreteRepositorio repositorio) =>
        {
            if (!Guid.TryParse(id, out var guid))
                return Results.BadRequest(new { mensagem = "Identificador inválido." });

            var lembrete = await repositorio.ObterAtivoAsync(guid);

            return lembrete is not null ? Results.Ok(lembrete) : Results.NotFound();
        });

        app.MapGet("/lembretes", async (LembreteRepositorio repositorio) =>
        {
            return Results.Ok(await repositorio.ListarAtivosAsync());
        });

        app.MapGet("/lembretes/filtro", async ([AsParameters] LembreteQueryDTO.LembreteQueryRequestDTO dto, LembreteRepositorio repositorio) =>
        {
            dto.NumeroPagina ??= 1;
            dto.TamanhoPagina ??= 10;

            if (dto.NumeroPagina <= 0 || dto.TamanhoPagina <= 0)
                return Results.BadRequest(new { mensagem = "Página e tamanho da página devem ser maiores que zero." });

            var lembretes = await repositorio.ListarAtivosAsync();
            var (resultado, total) = Filtrar(lembretes, dto);

            var resposta = new LembreteQueryDTO.LembreteQueryResponseDTO()
            {
                Total = total,
                NumeroPagina = dto.NumeroPagina.Value,
                TamanhoPagina = dto.TamanhoPagina.Value,
                Lembretes = resultado,
            };

            return Results.Ok(resposta);
        });

        //Biblioteca -> QuestPDF
        Settings.License = LicenseType.Community;

        app.MapGet("/lembretes/imprimir", async ([AsParameters] LembreteQueryDTO.LembreteQueryRequestDTO dto, LembreteRepositorio repositorio) =>
        {
            dto.NumeroPagina ??= 1;
            dto.TamanhoPagina ??= 10;

            if (dto.NumeroPagina <= 0 || dto.TamanhoPagina <= 0)
                return Results.BadRequest(new { mensagem = "Página e tamanho da página devem ser maiores que zero." });

            var todos = await repositorio.ListarAtivosAsync();
            var (lembretes, _) = Filtrar(todos, dto);

            var documento = Document.Create(container =>
            {
                container.Page(page =>
                {
                    page.Size(PageSizes.A4);
                    page.Margin(2, Unit.Centimetre);
                    page.PageColor(Color.FromHex("#FFFFFF"));

                    page.Header()
                        .Text("Relatório de Lembretes")
                        .SemiBold()
                        .FontSize(20)
                        .FontColor(Colors.Blue.Medium);

                    page
                        .Content()
                        .PaddingVertical(10)
                        .Column(column =>
                        {
                            column.Spacing(10);
                            column.Item().Text($"Gerado em: {DateTime.Now.ToLocalTime()}");

                            column
                                .Item()
                                .Table(tabela =>
                                {
                                    tabela.ColumnsDefinition(columns =>
                                    {
                                        columns.RelativeColumn();
                                        columns.ConstantColumn(110);
                                        columns.ConstantColumn(110);
                                        columns.ConstantColumn(80);
                                    });

                                    tabela.Header(header =>
                                    {
                                        header.Cell().Text("Descrição").SemiBold();
                                        header.Cell().Text("Cadastro").SemiBold();
                                        header.Cell().Text("Atualização").SemiBold();
                                        header.Cell().Text("Status").SemiBold();
                                    });

                                    foreach (var lembrete in lembretes)
                                    {
                                        tabela.Cell().Text(lembrete.Descricao).FontSize(10);
                                        tabela.Cell().Text(lembrete.DataCadastro.ToLocalTime()).FontSize(10);
                                        tabela.Cell().Text(lembrete.DataAtualizacao.ToLocalTime()).FontSize(10);
                                        tabela.Cell()
                                            .Text(lembrete.IsAtivo ? "Ativo" : "Inativo")
                                            .FontSize(10)
                                            .FontColor(lembrete.IsAtivo ? Colors.Green.Medium : Colors.Red.Medium);
                                    }
                                });
                        });

                    page.Footer().AlignCenter().Text(x => x.CurrentPageNumber());
                });
            });

            return Results.File(documento.GeneratePdf(), "application/pdf", "relatorio-lembretes.pdf");
        });

        app.MapDelete("/lembretes/{id}", async (string id, LembreteRepositorio repositorio) =>
        {
            if (!Guid.TryParse(id, out var guid))
                return Results.BadRequest(new { mensagem = "Identificador inválido." });

            var excluiu = await repositorio.ExcluirAsync(guid);

            return excluiu ? Results.NoContent() : Results.NotFound();
        });

        app.MapPut("/lembretes/{id}", async (string id, LembreteDTO dto, LembreteRepositorio repositorio) =>
        {
            if (!Guid.TryParse(id, out var guid))
                return Results.BadRequest(new { mensagem = "Identificador inválido." });

            var erro = ValidarDescricao(dto.Descricao);

            if (erro is not null)
                return Results.BadRequest(new { mensagem = erro });

            var lembrete = await repositorio.AtualizarAsync(guid, dto.Descricao.Trim());

            return lembrete is not null ? Results.Ok(lembrete) : Results.NotFound();
        });

        app.UseHttpsRedirection();

        //a api é iniciada de fato
        app.Run();
        //tudo que for colocado após o run será executado somente quando a api for parada
    }

    private static string? ValidarDescricao(string? descricao)
    {
        if (string.IsNullOrWhiteSpace(descricao))
            return "A descrição é obrigatória.";

        if (descricao.Trim().Length > 500)
            return "A descrição deve ter no máximo 500 caracteres.";

        return null;
    }

    private static (List<Lembrete> Lembretes, long Total) Filtrar(
        IEnumerable<Lembrete> origem, LembreteQueryDTO.LembreteQueryRequestDTO dto)
    {
        var consulta = origem.Where(x => x.IsAtivo);

        //busca por descrição (parcial e sem diferenciar maiúsculas/minúsculas)
        if (!string.IsNullOrWhiteSpace(dto.Descricao))
        {
            var termo = dto.Descricao.Trim();
            consulta = consulta.Where(x => x.Descricao.Contains(termo, StringComparison.OrdinalIgnoreCase));
        }

        // Filtros opcionais de data
        if (dto.DataCadastroInicial.HasValue)
            consulta = consulta.Where(x => x.DataCadastro >= dto.DataCadastroInicial.Value);

        if (dto.DataCadastroFinal.HasValue)
            consulta = consulta.Where(x => x.DataCadastro < dto.DataCadastroFinal.Value.Date.AddDays(1)); // inclui o dia inteiro

        if (dto.DataAtualizacaoInicial.HasValue)
            consulta = consulta.Where(x => x.DataAtualizacao >= dto.DataAtualizacaoInicial.Value);

        if (dto.DataAtualizacaoFinal.HasValue)
            consulta = consulta.Where(x => x.DataAtualizacao < dto.DataAtualizacaoFinal.Value.Date.AddDays(1)); // inclui o dia inteiro

        //normaliza a direção da ordenação
        var direcao = dto.Direcao?.Trim().ToUpperInvariant();

        if (direcao != "ASC" && direcao != "DESC")
            direcao = "DESC";

        var ascendente = direcao == "ASC";

        //ordenação por campo (lista branca evita ordenar por coluna inexistente)
        IOrderedEnumerable<Lembrete> ordenada = dto.Ordem?.Trim().ToLowerInvariant() switch
        {
            "descricao" => ascendente
                ? consulta.OrderBy(x => x.Descricao.ToLowerInvariant())
                : consulta.OrderByDescending(x => x.Descricao.ToLowerInvariant()),

            "dataatualizacao" => ascendente
                ? consulta.OrderBy(x => x.DataAtualizacao)
                : consulta.OrderByDescending(x => x.DataAtualizacao),

            "isativo" => ascendente
                ? consulta.OrderBy(x => x.IsAtivo)
                : consulta.OrderByDescending(x => x.IsAtivo),

            _ => ascendente
                ? consulta.OrderBy(x => x.DataCadastro)
                : consulta.OrderByDescending(x => x.DataCadastro)
        };

        //desempate estável para a paginação
        var lista = ordenada.ThenBy(x => x.Id).ToList();
        var total = lista.Count;

        // paginação (padrões já normalizados pelo endpoint: página 1, 10 registros)
        var pular = (dto.NumeroPagina!.Value - 1) * dto.TamanhoPagina!.Value;
        var pagina = lista.Skip(pular).Take(dto.TamanhoPagina.Value).ToList();

        return (pagina, total);
    }
}
