using System.Text.Json;
using umfg.programacaoiii.minimalapi._2026.Entidades;

namespace umfg.programacaoiii.minimalapi._2026.Repositorio;

/// <summary>
/// Armazena os lembretes em um arquivo JSON local (dados/lembretes.json).
/// Funciona como o "banco de dados" da aplicação, sem precisar de MySQL/Docker.
/// </summary>
public sealed class LembreteRepositorio
{
    private readonly string _caminhoArquivo;
    private readonly SemaphoreSlim _trava = new(1, 1);
    private readonly JsonSerializerOptions _opcoes = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        PropertyNameCaseInsensitive = true,
        WriteIndented = true,
    };

    public LembreteRepositorio(string caminhoArquivo)
    {
        _caminhoArquivo = caminhoArquivo;
        GarantirArquivo();
    }

    public async Task<List<Lembrete>> ListarAtivosAsync()
    {
        await _trava.WaitAsync();

        try
        {
            return (await LerAsync())
                .Where(x => x.IsAtivo)
                .ToList();
        }
        finally
        {
            _trava.Release();
        }
    }

    public async Task<Lembrete?> ObterAtivoAsync(Guid id)
    {
        await _trava.WaitAsync();

        try
        {
            return (await LerAsync())
                .FirstOrDefault(x => x.Id == id && x.IsAtivo);
        }
        finally
        {
            _trava.Release();
        }
    }

    public async Task AdicionarAsync(Lembrete lembrete)
    {
        await _trava.WaitAsync();

        try
        {
            var lembretes = await LerAsync();
            lembretes.Add(lembrete);
            await GravarAsync(lembretes);
        }
        finally
        {
            _trava.Release();
        }
    }

    public async Task<Lembrete?> AtualizarAsync(Guid id, string descricao)
    {
        await _trava.WaitAsync();

        try
        {
            var lembretes = await LerAsync();
            var lembrete = lembretes.FirstOrDefault(x => x.Id == id && x.IsAtivo);

            if (lembrete is null)
            {
                return null;
            }

            lembrete.SetDescricao(descricao);
            lembrete.Update();

            await GravarAsync(lembretes);

            return lembrete;
        }
        finally
        {
            _trava.Release();
        }
    }

    public async Task<bool> ExcluirAsync(Guid id)
    {
        await _trava.WaitAsync();

        try
        {
            var lembretes = await LerAsync();
            var lembrete = lembretes.FirstOrDefault(x => x.Id == id && x.IsAtivo);

            if (lembrete is null)
            {
                return false;
            }

            // exclusão lógica: mantém o registro e apenas marca como inativo
            lembrete.SetAtivo(false);
            lembrete.Update();

            await GravarAsync(lembretes);

            return true;
        }
        finally
        {
            _trava.Release();
        }
    }

    private void GarantirArquivo()
    {
        var diretorio = Path.GetDirectoryName(_caminhoArquivo);

        if (!string.IsNullOrWhiteSpace(diretorio))
        {
            Directory.CreateDirectory(diretorio);
        }

        if (!File.Exists(_caminhoArquivo))
        {
            File.WriteAllText(_caminhoArquivo, "[]");
        }
    }

    private async Task<List<Lembrete>> LerAsync()
    {
        await using var stream = File.OpenRead(_caminhoArquivo);

        var registros = await JsonSerializer.DeserializeAsync<List<LembreteArquivo>>(stream, _opcoes)
            ?? [];

        return registros
            .Select(x => new Lembrete(x.Id, x.Descricao, x.DataCadastro, x.DataAtualizacao, x.IsAtivo))
            .ToList();
    }

    private async Task GravarAsync(List<Lembrete> lembretes)
    {
        var registros = lembretes
            .Select(x => new LembreteArquivo
            {
                Id = x.Id,
                Descricao = x.Descricao,
                DataCadastro = x.DataCadastro,
                DataAtualizacao = x.DataAtualizacao,
                IsAtivo = x.IsAtivo,
            })
            .ToList();

        var temporario = _caminhoArquivo + ".tmp";

        await using (var stream = File.Create(temporario))
        {
            await JsonSerializer.SerializeAsync(stream, registros, _opcoes);
        }

        File.Move(temporario, _caminhoArquivo, overwrite: true);
    }

    private sealed class LembreteArquivo
    {
        public Guid Id { get; set; }
        public string Descricao { get; set; } = string.Empty;
        public DateTime DataCadastro { get; set; }
        public DateTime DataAtualizacao { get; set; }
        public bool IsAtivo { get; set; }
    }
}
