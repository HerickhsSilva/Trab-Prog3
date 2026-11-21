// =========================================================
// CONFIGURAÇÃO
// =========================================================

/**
 * Endereço da API (perfil "http" do launchSettings.json).
 * Se a API estiver em outra porta/origem, altere apenas esta constante.
 * Ex.: "https://localhost:7063" ao utilizar o perfil HTTPS.
 */
const API_URL = "http://localhost:5207";

const TIMEOUT_REQUISICAO = 15000;
const TAMANHO_PAGINA_PADRAO = 10;

// =========================================================
// ESTADO DA APLICAÇÃO
// =========================================================

const estado = {
    pagina: 1,
    totalPaginas: 1,
    total: 0,
    tamanhoPagina: TAMANHO_PAGINA_PADRAO,
    ordem: "DataCadastro",
    direcao: "DESC",
    filtros: criarFiltrosVazios(),
    carregando: false,
    salvando: false,
    excluindo: false,
    imprimindo: false,
};

let lembreteParaExcluir = null;
let requisicaoAtual = 0;
let temporizadorToast = null;

// =========================================================
// ELEMENTOS DA PÁGINA
// =========================================================

const el = {
    // formulário
    dialogoFormulario: document.getElementById("dialogoFormulario"),
    formLembrete: document.getElementById("formLembrete"),
    lembreteId: document.getElementById("lembreteId"),
    descricao: document.getElementById("descricao"),
    tituloFormulario: document.getElementById("tituloFormulario"),
    subtituloFormulario: document.getElementById("subtituloFormulario"),
    contadorDescricao: document.getElementById("contadorDescricao"),
    erroDescricao: document.getElementById("erroDescricao"),
    btnSalvar: document.getElementById("btnSalvar"),
    textoBtnSalvar: document.getElementById("textoBtnSalvar"),
    btnCancelar: document.getElementById("btnCancelar"),
    btnFecharFormulario: document.getElementById("btnFecharFormulario"),

    // filtros
    filtroDescricao: document.getElementById("filtroDescricao"),
    dataCadastroInicial: document.getElementById("dataCadastroInicial"),
    dataCadastroFinal: document.getElementById("dataCadastroFinal"),
    dataAtualizacaoInicial: document.getElementById("dataAtualizacaoInicial"),
    dataAtualizacaoFinal: document.getElementById("dataAtualizacaoFinal"),
    tamanhoPagina: document.getElementById("tamanhoPagina"),
    btnFiltrar: document.getElementById("btnFiltrar"),
    btnLimparFiltros: document.getElementById("btnLimparFiltros"),

    // listagem
    tabela: document.getElementById("tabelaLembretes"),
    listaLembretes: document.getElementById("listaLembretes"),
    mensagemVazia: document.getElementById("mensagemVazia"),
    textoVazio: document.getElementById("textoVazio"),
    btnNovoVazio: document.getElementById("btnNovoVazio"),
    estadoErro: document.getElementById("estadoErro"),
    textoErro: document.getElementById("textoErro"),
    btnTentarNovamente: document.getElementById("btnTentarNovamente"),
    resumoPaginacao: document.getElementById("resumoPaginacao"),

    // paginação
    paginas: document.getElementById("paginas"),
    btnPrimeira: document.getElementById("btnPrimeira"),
    btnAnterior: document.getElementById("btnAnterior"),
    btnProximo: document.getElementById("btnProximo"),
    btnUltima: document.getElementById("btnUltima"),

    // ações do cabeçalho
    btnImprimir: document.getElementById("btnImprimir"),
    btnNovo: document.getElementById("btnNovo"),
    statusApi: document.getElementById("statusApi"),

    // exclusão
    dialogoExclusao: document.getElementById("dialogoExclusao"),
    descricaoExclusao: document.getElementById("descricaoExclusao"),
    btnConfirmarExclusao: document.getElementById("btnConfirmarExclusao"),
    textoBtnExcluir: document.getElementById("textoBtnExcluir"),
    btnCancelarExclusao: document.getElementById("btnCancelarExclusao"),
    btnFecharExclusao: document.getElementById("btnFecharExclusao"),

    // toast
    toast: document.getElementById("toast"),
    toastTitulo: document.getElementById("toastTitulo"),
    toastMensagem: document.getElementById("toastMensagem"),
    toastFechar: document.getElementById("toastFechar"),
};

const formatadorData = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short" });
const formatadorHora = new Intl.DateTimeFormat("pt-BR", { timeStyle: "short" });

// =========================================================
// INICIALIZAÇÃO
// =========================================================

document.addEventListener("DOMContentLoaded", () => {
    registrarEventos();
    atualizarContadorDescricao();
    atualizarIndicadoresOrdenacao();
    carregarLembretes();
});

function registrarEventos() {
    // cabeçalho
    el.btnNovo.addEventListener("click", abrirFormularioNovo);
    el.btnImprimir.addEventListener("click", imprimirLembretes);
    el.btnNovoVazio.addEventListener("click", () => {
        if (el.btnNovoVazio.dataset.acao === "limpar") {
            limparFiltros();
        } else {
            abrirFormularioNovo();
        }
    });
    el.btnTentarNovamente.addEventListener("click", () => carregarLembretes());

    // formulário
    el.formLembrete.addEventListener("submit", salvarLembrete);
    el.btnCancelar.addEventListener("click", fecharFormulario);
    el.btnFecharFormulario.addEventListener("click", fecharFormulario);
    el.descricao.addEventListener("input", () => {
        atualizarContadorDescricao();
        limparErroDescricao();
    });
    el.dialogoFormulario.addEventListener("cancel", event => {
        if (estado.salvando) {
            event.preventDefault();
            return;
        }
        limparFormulario();
    });
    el.dialogoFormulario.addEventListener("close", limparFormulario);

    // exclusão
    el.btnConfirmarExclusao.addEventListener("click", confirmarExclusao);
    el.btnCancelarExclusao.addEventListener("click", fecharDialogoExclusao);
    el.btnFecharExclusao.addEventListener("click", fecharDialogoExclusao);
    el.dialogoExclusao.addEventListener("cancel", event => {
        if (estado.excluindo) {
            event.preventDefault();
        }
    });

    // filtros
    el.btnFiltrar.addEventListener("click", () => aplicarFiltros());
    el.btnLimparFiltros.addEventListener("click", () => limparFiltros());
    el.tamanhoPagina.addEventListener("change", () => aplicarFiltros());
    el.filtroDescricao.addEventListener("keydown", event => {
        if (event.key === "Enter") {
            event.preventDefault();
            aplicarFiltros();
        }
    });

    document.querySelectorAll(".filters input, .filters select").forEach(campo => {
        campo.addEventListener("keydown", event => {
            if (event.key === "Enter" && campo.tagName !== "SELECT") {
                event.preventDefault();
                aplicarFiltros();
            }
        });
    });

    document.querySelectorAll(".filters input[type='date']").forEach(campo => {
        campo.addEventListener("input", () => campo.removeAttribute("aria-invalid"));
    });

    // ordenação
    document.querySelectorAll(".sort").forEach(botao => {
        botao.addEventListener("click", () => alternarOrdenacao(botao.dataset.campo));
    });

    // paginação
    el.btnPrimeira.addEventListener("click", () => irParaPagina(1));
    el.btnAnterior.addEventListener("click", () => irParaPagina(estado.pagina - 1));
    el.btnProximo.addEventListener("click", () => irParaPagina(estado.pagina + 1));
    el.btnUltima.addEventListener("click", () => irParaPagina(estado.totalPaginas));
    el.paginas.addEventListener("click", event => {
        const botao = event.target.closest("button[data-pagina]");
        if (botao) {
            irParaPagina(Number(botao.dataset.pagina));
        }
    });

    // ações da tabela (delegação de eventos)
    el.listaLembretes.addEventListener("click", event => {
        const botao = event.target.closest("button[data-acao]");
        if (!botao) {
            return;
        }

        if (botao.dataset.acao === "editar") {
            abrirEdicao(botao.dataset.id);
        } else if (botao.dataset.acao === "excluir") {
            abrirDialogoExclusao(botao.dataset.id, botao.dataset.descricao);
        }
    });

    // toast
    el.toastFechar.addEventListener("click", esconderToast);

    // fechar modais ao clicar no backdrop
    [el.dialogoFormulario, el.dialogoExclusao].forEach(dialogo => {
        dialogo.addEventListener("click", event => {
            if (event.target !== dialogo) {
                return;
            }

            if (dialogo === el.dialogoFormulario && estado.salvando) {
                return;
            }

            if (dialogo === el.dialogoExclusao && estado.excluindo) {
                return;
            }

            dialogo.close();
        });
    });
}

// =========================================================
// GET /lembretes/filtro (filtros, ordenação e paginação)
// =========================================================

async function carregarLembretes() {
    const token = ++requisicaoAtual;

    estado.carregando = true;
    exibirCarregamento();

    try {
        const params = montarParametros();

        console.groupCollapsed("%cGET /lembretes/filtro", "color:#4f46e5;font-weight:bold");
        console.log("URL:", `${API_URL}/lembretes/filtro?${params.toString()}`);
        console.table(Object.fromEntries(params.entries()));
        console.groupEnd();

        const resposta = await apiFetch(`/lembretes/filtro?${params.toString()}`);
        const resultado = await resposta.json();

        if (token !== requisicaoAtual) {
            return;
        }

        const lembretes = normalizarLista(obterValor(resultado, "lembretes", "Lembretes") || []);
        const total = Number(obterValor(resultado, "total", "Total") || 0);
        const tamanhoPagina = Number(obterValor(resultado, "tamanhoPagina", "TamanhoPagina") || estado.tamanhoPagina);

        estado.total = total;
        estado.tamanhoPagina = tamanhoPagina;
        estado.totalPaginas = Math.max(1, Math.ceil(total / tamanhoPagina));

        // Se a página atual deixou de existir (ex.: último item excluído),
        // recua para a última página disponível e refaz a consulta.
        if (total > 0 && lembretes.length === 0 && estado.pagina > estado.totalPaginas) {
            estado.pagina = estado.totalPaginas;
            estado.carregando = false;
            return carregarLembretes();
        }

        renderizarLembretes(lembretes);
        renderizarPaginacao();
        definirApiOnline(true);
    } catch (erro) {
        if (token !== requisicaoAtual) {
            return;
        }

        console.error("Falha ao carregar lembretes:", erro);
        exibirErroCarregamento(erro);
    } finally {
        if (token === requisicaoAtual) {
            estado.carregando = false;
            finalizarCarregamento();
        }
    }
}

function montarParametros() {
    const params = new URLSearchParams();

    params.set("NumeroPagina", String(estado.pagina));
    params.set("TamanhoPagina", String(estado.tamanhoPagina));
    params.set("Ordem", estado.ordem);
    params.set("Direcao", estado.direcao);

    if (estado.filtros.descricao) {
        params.set("Descricao", estado.filtros.descricao);
    }

    if (estado.filtros.dataCadastroInicial) {
        params.set("DataCadastroInicial", estado.filtros.dataCadastroInicial);
    }

    if (estado.filtros.dataCadastroFinal) {
        params.set("DataCadastroFinal", estado.filtros.dataCadastroFinal);
    }

    if (estado.filtros.dataAtualizacaoInicial) {
        params.set("DataAtualizacaoInicial", estado.filtros.dataAtualizacaoInicial);
    }

    if (estado.filtros.dataAtualizacaoFinal) {
        params.set("DataAtualizacaoFinal", estado.filtros.dataAtualizacaoFinal);
    }

    return params;
}

// =========================================================
// POST /lembretes | PUT /lembretes/{id}
// =========================================================

async function salvarLembrete(event) {
    event.preventDefault();

    if (estado.salvando) {
        return;
    }

    const descricao = el.descricao.value.trim();
    const id = el.lembreteId.value;

    if (!descricao) {
        exibirErroDescricao("Informe uma descrição para o lembrete.");
        el.descricao.focus();
        mostrarToast("O campo descrição é obrigatório.", "warning", "Campo obrigatório");
        return;
    }

    if (descricao.length > 500) {
        exibirErroDescricao("A descrição deve ter no máximo 500 caracteres.");
        el.descricao.focus();
        return;
    }

    const editando = Boolean(id);
    const dados = { descricao };

    definirSalvando(true);

    try {
        const url = editando
            ? `${API_URL}/lembretes/${encodeURIComponent(id)}`
            : `${API_URL}/lembretes`;

        console.groupCollapsed(`%c${editando ? "PUT" : "POST"} ${url}`, "color:#4f46e5;font-weight:bold");
        console.log("Corpo da requisição:", dados);
        console.groupEnd();

        await apiFetch(editando ? `/lembretes/${encodeURIComponent(id)}` : "/lembretes", {
            method: editando ? "PUT" : "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(dados),
        });

        el.dialogoFormulario.close();

        mostrarToast(
            editando
                ? "As alterações foram salvas com sucesso."
                : "O lembrete foi cadastrado com sucesso.",
            "success",
            editando ? "Lembrete atualizado" : "Lembrete cadastrado"
        );

        if (!editando) {
            estado.pagina = 1;
        }

        await carregarLembretes();
    } catch (erro) {
        console.error("Falha ao salvar lembrete:", erro);

        if (erro.status === 404) {
            mostrarToast("Este lembrete não existe mais. A listagem será atualizada.", "error", "Lembrete não encontrado");
            el.dialogoFormulario.close();
            await carregarLembretes();
            return;
        }

        exibirErroDescricao(erro.message || "Não foi possível salvar o lembrete.");
        mostrarToast(erro.message || "Não foi possível salvar o lembrete.", "error", "Erro ao salvar");
    } finally {
        definirSalvando(false);
    }
}

// =========================================================
// GET /lembretes/{id}
// =========================================================

async function abrirEdicao(id) {
    if (!id) {
        return;
    }

    try {
        const resposta = await apiFetch(`/lembretes/${encodeURIComponent(id)}`);
        const dados = await resposta.json();
        const lembrete = normalizarLembrete(dados);

        el.formLembrete.reset();
        el.lembreteId.value = lembrete.id;
        el.descricao.value = lembrete.descricao;

        el.tituloFormulario.textContent = "Editar lembrete";
        el.subtituloFormulario.textContent = "Altere a descrição e salve para confirmar as mudanças.";
        el.textoBtnSalvar.textContent = "Salvar alterações";

        limparErroDescricao();
        atualizarContadorDescricao();

        abrirDialogo(el.dialogoFormulario);
        el.descricao.focus();
        el.descricao.setSelectionRange(el.descricao.value.length, el.descricao.value.length);
    } catch (erro) {
        console.error("Falha ao buscar lembrete:", erro);

        if (erro.status === 404) {
            mostrarToast("O lembrete não foi encontrado. Ele pode ter sido excluído.", "error", "Não encontrado");
            await carregarLembretes();
            return;
        }

        mostrarToast(erro.message || "Não foi possível buscar o lembrete.", "error", "Erro ao consultar");
    }
}

// =========================================================
// DELETE /lembretes/{id}
// =========================================================

function abrirDialogoExclusao(id, descricao) {
    lembreteParaExcluir = { id, descricao: descricao || "Sem descrição" };
    el.descricaoExclusao.textContent = lembreteParaExcluir.descricao;

    abrirDialogo(el.dialogoExclusao);
    el.btnConfirmarExclusao.focus();
}

function fecharDialogoExclusao() {
    if (estado.excluindo) {
        return;
    }

    el.dialogoExclusao.close();
}

async function confirmarExclusao() {
    if (!lembreteParaExcluir || estado.excluindo) {
        return;
    }

    definirExcluindo(true);

    try {
        await apiFetch(`/lembretes/${encodeURIComponent(lembreteParaExcluir.id)}`, {
            method: "DELETE",
        });

        el.dialogoExclusao.close();
        mostrarToast("O lembrete foi removido da listagem.", "success", "Lembrete excluído");

        lembreteParaExcluir = null;
        await carregarLembretes();
    } catch (erro) {
        console.error("Falha ao excluir lembrete:", erro);

        if (erro.status === 404) {
            el.dialogoExclusao.close();
            lembreteParaExcluir = null;
            mostrarToast("O lembrete já havia sido excluído. A listagem foi atualizada.", "warning", "Não encontrado");
            await carregarLembretes();
            return;
        }

        mostrarToast(erro.message || "Não foi possível excluir o lembrete.", "error", "Erro ao excluir");
    } finally {
        definirExcluindo(false);
    }
}

// =========================================================
// GET /lembretes/imprimir
// =========================================================

async function imprimirLembretes() {
    if (estado.imprimindo) {
        return;
    }

    definirImprimindo(true);

    try {
        const params = montarParametros();
        params.set("NumeroPagina", "1");
        params.set("TamanhoPagina", "1000");

        const resposta = await apiFetch(`/lembretes/imprimir?${params.toString()}`);
        const blob = await resposta.blob();

        if (!blob.size) {
            throw new Error("A API retornou um arquivo vazio.");
        }

        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = "relatorio-lembretes.pdf";

        document.body.appendChild(link);
        link.click();
        link.remove();

        setTimeout(() => URL.revokeObjectURL(url), 15000);

        mostrarToast("O download do relatório em PDF foi iniciado.", "success", "Relatório gerado");
    } catch (erro) {
        console.error("Falha ao gerar PDF:", erro);
        mostrarToast(erro.message || "Não foi possível gerar o relatório.", "error", "Erro ao imprimir");
    } finally {
        definirImprimindo(false);
    }
}

// =========================================================
// FILTROS
// =========================================================

function aplicarFiltros() {
    const filtros = lerFiltrosFormulario();
    const periodoInvalido = validarPeriodos(filtros);

    if (periodoInvalido) {
        mostrarToast(periodoInvalido.mensagem, "warning", "Período inválido");
        periodoInvalido.campo.focus();
        return;
    }

    estado.filtros = filtros;
    estado.tamanhoPagina = Number(el.tamanhoPagina.value) || TAMANHO_PAGINA_PADRAO;
    estado.pagina = 1;

    carregarLembretes();
}

function limparFiltros() {
    el.filtroDescricao.value = "";
    el.dataCadastroInicial.value = "";
    el.dataCadastroFinal.value = "";
    el.dataAtualizacaoInicial.value = "";
    el.dataAtualizacaoFinal.value = "";
    el.tamanhoPagina.value = String(TAMANHO_PAGINA_PADRAO);

    removerInvalidos();
    estado.filtros = criarFiltrosVazios();
    estado.tamanhoPagina = TAMANHO_PAGINA_PADRAO;
    estado.pagina = 1;

    carregarLembretes();
    mostrarToast("Todos os filtros foram removidos.", "info", "Filtros limpos");
}

function lerFiltrosFormulario() {
    return {
        descricao: el.filtroDescricao.value.trim(),
        dataCadastroInicial: el.dataCadastroInicial.value,
        dataCadastroFinal: el.dataCadastroFinal.value,
        dataAtualizacaoInicial: el.dataAtualizacaoInicial.value,
        dataAtualizacaoFinal: el.dataAtualizacaoFinal.value,
    };
}

function validarPeriodos(filtros) {
    removerInvalidos();

    if (
        filtros.dataCadastroInicial &&
        filtros.dataCadastroFinal &&
        filtros.dataCadastroInicial > filtros.dataCadastroFinal
    ) {
        el.dataCadastroInicial.setAttribute("aria-invalid", "true");
        el.dataCadastroFinal.setAttribute("aria-invalid", "true");

        return {
            campo: el.dataCadastroInicial,
            mensagem: "A data inicial de cadastro não pode ser maior que a data final.",
        };
    }

    if (
        filtros.dataAtualizacaoInicial &&
        filtros.dataAtualizacaoFinal &&
        filtros.dataAtualizacaoInicial > filtros.dataAtualizacaoFinal
    ) {
        el.dataAtualizacaoInicial.setAttribute("aria-invalid", "true");
        el.dataAtualizacaoFinal.setAttribute("aria-invalid", "true");

        return {
            campo: el.dataAtualizacaoInicial,
            mensagem: "A data inicial de atualização não pode ser maior que a data final.",
        };
    }

    return null;
}

function removerInvalidos() {
    [
        el.dataCadastroInicial,
        el.dataCadastroFinal,
        el.dataAtualizacaoInicial,
        el.dataAtualizacaoFinal,
    ].forEach(campo => campo.removeAttribute("aria-invalid"));
}

function criarFiltrosVazios() {
    return {
        descricao: "",
        dataCadastroInicial: "",
        dataCadastroFinal: "",
        dataAtualizacaoInicial: "",
        dataAtualizacaoFinal: "",
    };
}

function temFiltrosAtivos() {
    return Object.values(estado.filtros).some(valor => Boolean(valor));
}

// =========================================================
// ORDENAÇÃO
// =========================================================

function alternarOrdenacao(campo) {
    if (estado.carregando) {
        return;
    }

    if (estado.ordem === campo) {
        estado.direcao = estado.direcao === "ASC" ? "DESC" : "ASC";
    } else {
        estado.ordem = campo;
        estado.direcao = campo === "Descricao" ? "ASC" : "DESC";
    }

    estado.pagina = 1;
    atualizarIndicadoresOrdenacao();
    carregarLembretes();
}

function atualizarIndicadoresOrdenacao() {
    document.querySelectorAll(".sort").forEach(botao => {
        const campo = botao.dataset.campo;
        const th = botao.closest("th");
        const ativo = campo === estado.ordem;
        const nome = botao.textContent.trim();

        if (ativo) {
            th.setAttribute("aria-sort", estado.direcao === "ASC" ? "ascending" : "descending");
            botao.title = `Ordenado por ${nome} (${estado.direcao === "ASC" ? "crescente" : "decrescente"})`;
        } else {
            th.setAttribute("aria-sort", "none");
            botao.title = `Ordenar por ${nome}`;
        }
    });
}

// =========================================================
// PAGINAÇÃO
// =========================================================

function irParaPagina(pagina) {
    if (estado.carregando) {
        return;
    }

    const destino = Math.min(Math.max(1, pagina), estado.totalPaginas);

    if (destino === estado.pagina) {
        return;
    }

    estado.pagina = destino;
    carregarLembretes();
}

function renderizarPaginacao() {
    const totalPaginas = estado.totalPaginas;

    el.paginas.innerHTML = obterSequenciaPaginas(totalPaginas)
        .map(pagina => {
            if (pagina === "…") {
                return '<span class="pagination__ellipsis" aria-hidden="true">…</span>';
            }

            const ativa = pagina === estado.pagina;

            return `
                <button type="button"
                        class="pagination__btn${ativa ? " is-active" : ""}"
                        data-pagina="${pagina}"
                        ${ativa ? 'aria-current="page"' : ""}
                        aria-label="Página ${pagina}">
                    ${pagina}
                </button>
            `;
        })
        .join("");

    el.btnPrimeira.disabled = estado.pagina <= 1;
    el.btnAnterior.disabled = estado.pagina <= 1;
    el.btnProximo.disabled = estado.pagina >= totalPaginas;
    el.btnUltima.disabled = estado.pagina >= totalPaginas;

    const inicio = estado.total === 0 ? 0 : (estado.pagina - 1) * estado.tamanhoPagina + 1;
    const fim = Math.min(estado.pagina * estado.tamanhoPagina, estado.total);

    if (estado.total === 0) {
        el.resumoPaginacao.textContent = "Nenhum registro encontrado";
        return;
    }

    const rotuloRegistros = estado.total === 1 ? "registro" : "registros";
    el.resumoPaginacao.textContent =
        `Mostrando ${inicio}–${fim} de ${estado.total} ${rotuloRegistros} · Página ${estado.pagina} de ${totalPaginas}`;
}

function obterSequenciaPaginas(totalPaginas) {
    if (totalPaginas <= 7) {
        return Array.from({ length: totalPaginas }, (_, indice) => indice + 1);
    }

    const paginas = [1];
    const inicio = Math.max(2, estado.pagina - 1);
    const fim = Math.min(totalPaginas - 1, estado.pagina + 1);

    if (inicio > 2) {
        paginas.push("…");
    }

    for (let pagina = inicio; pagina <= fim; pagina++) {
        paginas.push(pagina);
    }

    if (fim < totalPaginas - 1) {
        paginas.push("…");
    }

    paginas.push(totalPaginas);

    return paginas;
}

// =========================================================
// RENDERIZAÇÃO DA TABELA
// =========================================================

function renderizarLembretes(lembretes) {
    if (!lembretes.length) {
        el.listaLembretes.innerHTML = "";

        const filtrando = temFiltrosAtivos();
        el.textoVazio.textContent = filtrando
            ? "Nenhum lembrete corresponde aos filtros aplicados. Ajuste os critérios e tente novamente."
            : "Você ainda não possui lembretes cadastrados. Crie o primeiro para começar.";

        el.btnNovoVazio.textContent = filtrando ? "Limpar filtros" : "Cadastrar lembrete";
        el.btnNovoVazio.dataset.acao = filtrando ? "limpar" : "novo";
        el.mensagemVazia.classList.remove("hidden");

        return;
    }

    el.mensagemVazia.classList.add("hidden");
    el.listaLembretes.innerHTML = lembretes.map(montarLinha).join("");
}

function montarLinha(lembrete) {
    const descricao = escapeHtml(lembrete.descricao);
    const id = escapeHtml(lembrete.id);
    const statusClasse = lembrete.isAtivo ? "status--ativo" : "status--inativo";
    const statusTexto = lembrete.isAtivo ? "Ativo" : "Inativo";

    return `
        <tr>
            <td data-label="Descrição">
                <span class="cell-desc" title="${descricao}">${descricao}</span>
            </td>

            <td data-label="Cadastro">
                ${montarData(lembrete.dataCadastro)}
            </td>

            <td data-label="Atualização">
                ${montarData(lembrete.dataAtualizacao)}
            </td>

            <td data-label="Status">
                <span class="status ${statusClasse}">${statusTexto}</span>
            </td>

            <td data-label="Ações">
                <div class="actions">
                    <button type="button"
                            class="btn btn--row btn--row-edit"
                            data-acao="editar"
                            data-id="${id}"
                            title="Editar lembrete">
                        Editar
                    </button>

                    <button type="button"
                            class="btn btn--row btn--row-danger"
                            data-acao="excluir"
                            data-id="${id}"
                            data-descricao="${descricao}"
                            title="Excluir lembrete">
                        Excluir
                    </button>
                </div>
            </td>
        </tr>
    `;
}

function montarData(valor) {
    if (!valor) {
        return '<span class="cell-date">—</span>';
    }

    const data = new Date(valor);

    if (Number.isNaN(data.getTime())) {
        return '<span class="cell-date">—</span>';
    }

    return `
        <span class="cell-date">
            ${formatadorData.format(data)}
            <small>${formatadorHora.format(data)}</small>
        </span>
    `;
}

// =========================================================
// ESTADOS VISUAIS (carregando / vazio / erro)
// =========================================================

function exibirCarregamento() {
    el.estadoErro.classList.add("hidden");
    el.mensagemVazia.classList.add("hidden");
    el.tabela.setAttribute("aria-busy", "true");

    el.listaLembretes.innerHTML = Array.from(
        { length: Math.min(5, estado.tamanhoPagina) },
        () => `
            <tr class="skeleton-row" aria-hidden="true">
                <td data-label="Descrição"><span class="skeleton"></span></td>
                <td data-label="Cadastro"><span class="skeleton skeleton--sm"></span></td>
                <td data-label="Atualização"><span class="skeleton skeleton--xs"></span></td>
                <td data-label="Status"><span class="skeleton skeleton--badge"></span></td>
                <td data-label="Ações"><span class="skeleton skeleton--xs"></span></td>
            </tr>
        `
    ).join("");
}

function finalizarCarregamento() {
    el.tabela.removeAttribute("aria-busy");
}

function exibirErroCarregamento(erro) {
    el.listaLembretes.innerHTML = "";
    el.mensagemVazia.classList.add("hidden");
    el.estadoErro.classList.remove("hidden");

    el.textoErro.textContent = erro.codigo === "rede" || erro.codigo === "timeout"
        ? `Não foi possível se comunicar com a API. Confirme se o servidor está em execução em ${API_URL} e tente novamente.`
        : (erro.message || "Ocorreu um erro inesperado ao consultar os lembretes.");

    el.resumoPaginacao.textContent = "Não foi possível carregar os registros";
    el.paginas.innerHTML = "";
    el.btnPrimeira.disabled = true;
    el.btnAnterior.disabled = true;
    el.btnProximo.disabled = true;
    el.btnUltima.disabled = true;

    if (erro.codigo === "rede" || erro.codigo === "timeout") {
        definirApiOnline(false);
    }

    mostrarToast(
        erro.codigo === "rede"
            ? "Falha de comunicação com a API. Verifique se o serviço está em execução."
            : (erro.message || "Erro ao carregar os lembretes."),
        "error",
        "Erro na consulta"
    );
}

// =========================================================
// FORMULÁRIO
// =========================================================

function abrirFormularioNovo() {
    el.formLembrete.reset();
    el.lembreteId.value = "";
    el.descricao.value = "";

    el.tituloFormulario.textContent = "Novo lembrete";
    el.subtituloFormulario.textContent = "Preencha a descrição para cadastrar um novo lembrete.";
    el.textoBtnSalvar.textContent = "Salvar lembrete";

    limparErroDescricao();
    atualizarContadorDescricao();

    abrirDialogo(el.dialogoFormulario);
    el.descricao.focus();
}

function fecharFormulario() {
    if (estado.salvando) {
        return;
    }

    el.dialogoFormulario.close();
}

function abrirDialogo(dialogo) {
    if (dialogo.open) {
        return;
    }

    if (typeof dialogo.showModal === "function") {
        dialogo.showModal();
    } else {
        dialogo.setAttribute("open", "");
    }
}

function limparFormulario() {
    el.formLembrete.reset();
    el.lembreteId.value = "";
    el.descricao.value = "";
    limparErroDescricao();
    atualizarContadorDescricao();
}

function atualizarContadorDescricao() {
    const tamanho = el.descricao.value.length;
    el.contadorDescricao.textContent = `${tamanho}/500`;
    el.contadorDescricao.classList.toggle("is-near-limit", tamanho > 450);
}

function exibirErroDescricao(mensagem) {
    el.erroDescricao.textContent = mensagem;
    el.erroDescricao.classList.remove("hidden");
    el.descricao.setAttribute("aria-invalid", "true");
}

function limparErroDescricao() {
    el.erroDescricao.textContent = "";
    el.erroDescricao.classList.add("hidden");
    el.descricao.removeAttribute("aria-invalid");
}

function definirSalvando(salvando) {
    estado.salvando = salvando;

    el.btnSalvar.disabled = salvando;
    el.btnCancelar.disabled = salvando;
    el.btnFecharFormulario.disabled = salvando;
    el.btnSalvar.classList.toggle("btn--loading", salvando);
    el.textoBtnSalvar.textContent = salvando
        ? "Salvando..."
        : (el.lembreteId.value ? "Salvar alterações" : "Salvar lembrete");
}

function definirExcluindo(excluindo) {
    estado.excluindo = excluindo;

    el.btnConfirmarExclusao.disabled = excluindo;
    el.btnCancelarExclusao.disabled = excluindo;
    el.btnFecharExclusao.disabled = excluindo;
    el.btnConfirmarExclusao.classList.toggle("btn--loading", excluindo);
    el.textoBtnExcluir.textContent = excluindo ? "Excluindo..." : "Excluir";
}

function definirImprimindo(imprimindo) {
    estado.imprimindo = imprimindo;

    el.btnImprimir.disabled = imprimindo;
    el.btnImprimir.classList.toggle("btn--loading", imprimindo);
    el.btnImprimir.querySelector("span").textContent = imprimindo ? "Gerando PDF..." : "Imprimir PDF";
}

// =========================================================
// COMUNICAÇÃO COM A API
// =========================================================

async function apiFetch(caminho, opcoes = {}) {
    const controlador = new AbortController();
    const temporizador = setTimeout(() => controlador.abort(), TIMEOUT_REQUISICAO);

    try {
        const resposta = await fetch(`${API_URL}${caminho}`, {
            ...opcoes,
            signal: controlador.signal,
            headers: {
                Accept: "application/json",
                ...(opcoes.headers || {}),
            },
        });

        if (!resposta.ok) {
            const tipoConteudo = resposta.headers.get("content-type") || "";
            let corpo = null;

            if (tipoConteudo.includes("json")) {
                try {
                    corpo = await resposta.json();
                } catch {
                    corpo = null;
                }
            }

            const mensagem = corpo?.mensagem || corpo?.message || corpo?.title || mensagemHttp(resposta.status);
            const erro = new Error(mensagem);
            erro.status = resposta.status;
            throw erro;
        }

        return resposta;
    } catch (erro) {
        if (erro.name === "AbortError") {
            const timeout = new Error("A API demorou demais para responder. Tente novamente.");
            timeout.codigo = "timeout";
            throw timeout;
        }

        if (erro instanceof TypeError) {
            const rede = new Error("Não foi possível se comunicar com a API. Verifique se ela está em execução.");
            rede.codigo = "rede";
            throw rede;
        }

        throw erro;
    } finally {
        clearTimeout(temporizador);
    }
}

function mensagemHttp(status) {
    switch (status) {
        case 400:
            return "A API recusou os dados enviados. Verifique as informações e tente novamente.";
        case 401:
        case 403:
            return "Você não tem permissão para realizar esta operação.";
        case 404:
            return "O registro solicitado não foi encontrado.";
        case 409:
            return "Não foi possível concluir a operação devido a um conflito nos dados.";
        case 500:
        case 502:
        case 503:
            return "A API encontrou um erro interno. Tente novamente em alguns instantes.";
        default:
            return `A API retornou um erro inesperado (HTTP ${status}).`;
    }
}

function definirApiOnline(online) {
    el.statusApi.classList.toggle("is-offline", !online);
    el.statusApi.textContent = online ? "Conectado à API" : "API indisponível";
}

// =========================================================
// NOTIFICAÇÕES
// =========================================================

const TITULOS_TOAST = {
    success: "Sucesso",
    error: "Erro",
    warning: "Atenção",
    info: "Informação",
};

function mostrarToast(mensagem, tipo = "info", titulo = null) {
    clearTimeout(temporizadorToast);

    el.toast.className = `toast toast--${tipo}`;
    el.toastTitulo.textContent = titulo || TITULOS_TOAST[tipo] || "Informação";
    el.toastMensagem.textContent = mensagem;
    el.toast.setAttribute("role", tipo === "error" ? "alert" : "status");

    // reinicia a animação mesmo com toasts consecutivos
    void el.toast.offsetWidth;
    el.toast.classList.add("is-visible");

    temporizadorToast = setTimeout(esconderToast, 4500);
}

function esconderToast() {
    clearTimeout(temporizadorToast);
    el.toast.classList.remove("is-visible");
}

// =========================================================
// UTILITÁRIOS
// =========================================================

function obterValor(objeto, ...chaves) {
    for (const chave of chaves) {
        if (objeto && objeto[chave] !== undefined) {
            return objeto[chave];
        }
    }

    return undefined;
}

function normalizarLista(lista) {
    return Array.isArray(lista) ? lista.map(normalizarLembrete) : [];
}

function normalizarLembrete(registro) {
    const isAtivo = obterValor(registro, "isAtivo", "IsAtivo");

    return {
        id: obterValor(registro, "id", "Id") || "",
        descricao: obterValor(registro, "descricao", "Descricao") || "",
        dataCadastro: obterValor(registro, "dataCadastro", "DataCadastro") || null,
        dataAtualizacao: obterValor(registro, "dataAtualizacao", "DataAtualizacao") || null,
        isAtivo: isAtivo === true || isAtivo === "true" || isAtivo === 1,
    };
}

function escapeHtml(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caractere => {
        const mapa = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;",
        };

        return mapa[caractere];
    });
}
