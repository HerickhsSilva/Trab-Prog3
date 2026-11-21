using umfg.programacaoiii.minimalapi._2026.Entidades;

namespace umfg.programacaoiii.minimalapi._2026.DTO;

public sealed class LembreteQueryDTO
{
    public sealed class LembreteQueryRequestDTO
    {
        private const string C_ORDEM_PADRAO = "DataCadastro";
        private const string C_DIRECAO_PADRAO = "DESC";

        /// <summary>
        /// Página solicitada. Quando omitida, assume 1.
        /// </summary>        
        public int? NumeroPagina { get; set; }

        /// <summary>
        /// Registros por página. Quando omitido, assume 10.
        /// </summary>        
        public int? TamanhoPagina { get; set; }

        /// <summary>
        /// Filtro para ordenação dos registros retornados. Padrão Nome.
        /// </summary>        
        public string? Ordem { get; set; } = C_ORDEM_PADRAO;

        /// <summary>
        /// Direção (DESC - ASC) da ordenação dos registros retornados. Padrão DESC.
        /// </summary>        
        public string? Direcao { get; set; } = C_DIRECAO_PADRAO;
        
        public string? Descricao { get; set; } = string.Empty;
        
        public DateTime? DataCadastroInicial { get; set; }

        public DateTime? DataCadastroFinal { get; set; }

        public DateTime? DataAtualizacaoInicial { get; set; }

        public DateTime? DataAtualizacaoFinal { get; set; }
    }

    public sealed class LembreteQueryResponseDTO
    {
        public ICollection<Lembrete> Lembretes { get; set; } = [];

        public long Total { get; set; } = 0;

        public int NumeroPagina { get; set; } = 0;

        public int TamanhoPagina { get; set; } = 0;
    }
}