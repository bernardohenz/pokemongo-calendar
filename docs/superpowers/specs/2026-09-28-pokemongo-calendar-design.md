# Calendário de eventos do Pokémon GO

Página estática para ver eventos do Pokémon GO no mês corrente. Cada evento é um arquivo JSON. Um índice manual lista esses arquivos. O site não tem build, banco nem servidor próprio: um host gratuito só precisa servir os arquivos.

## Decisões

- Página única em HTML, CSS e JavaScript, sem framework e sem biblioteca de calendário.
- Um JSON por evento, com chaves em inglês: `name`, `description`, `start`, `end`, `tags`, `images`, `coordinates`.
- `eventos/index.json` é um array de nomes de arquivo, editado à mão.
- Data sozinha significa dia inteiro. Data com hora significa uma janela local, sem fuso no arquivo.
- O mês mostra um ponto por evento. O detalhe (nome, horário, lista, coordenadas, tags) abre ao clicar no dia.
- Interface em português. A semana começa no domingo.
- Tags aparecem no painel. Os filtros do topo usam as cinco tags principais e escondem da grade e do painel o que não combina com nenhuma tag ligada.

## Arquivos

```
index.html
styles.css
calendar.js
README.md
eventos/index.json
eventos/2026-09-27-tcg-30-lojas-eua.json
eventos/2026-10-17-dia-de-chocar-sandile.json
eventos/2026-11-06-festival-das-luzes-india.json
eventos/2026-11-14-area-selvagem-global.json
```

O README explica como adicionar um evento, o formato do JSON e como abrir a página localmente.

## Evento

```json
{
  "name": "Festival das Luzes na Índia",
  "description": [
    "Evento local gratuito, em toda a Índia",
    "Pikachu com Saree e Pikachu com Kurta"
  ],
  "start": "2026-11-06T10:00",
  "end": "2026-11-08T20:00",
  "tags": ["free"],
  "coordinates": [
    { "lat": 28.6315, "lng": 77.2167, "note": "Connaught Place, Deli" }
  ],
  "images": ["eventos/imagens/resumo.jpg"]
}
```

Dia inteiro, sem coordenadas:

```json
{
  "name": "Raids Mega Latios",
  "description": ["Latios em mega raids a semana inteira."],
  "start": "2026-10-07",
  "end": "2026-10-14",
  "tags": ["mega"]
}
```

| Campo | Regra |
| --- | --- |
| `name` | Texto obrigatório, não vazio. |
| `description` | Lista de textos. Ausente vira `[]`. Texto solto, item vazio ou item que não seja texto invalida o arquivo. O painel mostra um item por linha. |
| `start`, `end` | Obrigatórios. Os dois são `AAAA-MM-DD` ou os dois são `AAAA-MM-DDTHH:MM`. |
| `tags` | Lista de textos. Ausente vira `[]`. Item que não seja texto invalida o arquivo. Tags não são exclusivas. |
| `images` | Lista opcional de caminhos relativos à pasta do site. Ausente vira `[]`. Item vazio, que não seja texto, com `..`, barra inicial ou URL invalida o arquivo. O painel mostra cada imagem. |
| `coordinates` | Lista opcional. Cada item é um objeto com `lat` e `lng` numéricos (`lat` de −90 a 90, `lng` de −180 a 180) e `note` opcional. Ausente vira `[]`. Outro formato invalida o arquivo. Clicar na coordenada copia `lat, lng`. |

Campos além desses são ignorados. A paleta exata fica para a implementação: as cinco tags conhecidas precisam ser distinguíveis entre si, e qualquer outra tag divide uma única cor neutra.

Horários são hora local, sem sufixo de fuso. O “hoje” e o dia em que uma hora cai usam o relógio do navegador.

Intervalo:

- Com hora, o intervalo é `[start, end)`. `14:00`–`17:00` cobre esse trecho e não inclui 17:00. Um evento que termina `2026-10-13T00:00` não marca o dia 13.
- Só com data, `end` é inclusive. `2026-10-07`–`2026-10-14` cobre o dia 14 inteiro, equivalente a `[2026-10-07T00:00, 2026-10-15T00:00)`.
- `start` igual a `end` em dia inteiro é um dia válido. Com hora, `start` igual a `end` é inválido.
- A data tem de existir no calendário. `2026-02-31` é inválido.

Tags iniciais, com cor própria: `dia-comunitario`, `shiny-boost`, `mega`, `pago`, `free`. Uma tag fora dessa lista usa a cor neutra. O ponto do evento usa a primeira tag desta lista que ele tiver. O nome da tag continua visível no painel, para a cor não ser a única informação.

O nome do arquivo é livre. A convenção sugerida é `AAAA-MM-DD-slug.json`, para a pasta ordenar por data. A página acha o arquivo pelo índice, não pelo nome.

## Índice

`eventos/index.json` é um array JSON de nomes, relativos à pasta `eventos/`:

```json
[
  "2026-10-07-mega-latios.json",
  "2026-10-12-community-day-eevee.json"
]
```

Cada item é só o nome do arquivo: sem pasta, sem `..`. Nome repetido conta uma vez.

## Página

Ao abrir, o mês corrente aparece e o dia de hoje fica selecionado.

O topo tem o nome do mês em português (`setembro 2026`), o mês anterior, o mês seguinte e o botão “Hoje”. A grade inclui os dias do mês vizinho, mais apagados. Esses dias são clicáveis e não trocam o mês exibido.

Cada evento ativo naquele dia civil vira um ponto. Vários pontos cabem na célula. A cor segue a prioridade `dia-comunitario`, `shiny-boost`, `mega`, `pago`, `free` e, por último, a cor neutra.

Clicar num dia seleciona esse dia. O painel lista só o título de cada evento. Clicar no título abre o resto: “dia inteiro” ou o horário em 24 horas (`14:00–17:00`), a lista da descrição, as coordenadas, as tags e, se houver, as imagens do resumo. Clicar numa coordenada copia `lat, lng` e o botão mostra “Copiado” por um instante. Sem eventos, o painel diz “Nenhum evento neste dia”. No desktop o painel fica ao lado da grade. No celular, abaixo.

Acima da grade há um botão para cada tag principal: Dia comunitário, Brilhante, Mega, Pago e Grátis. Todos começam ligados. Desligar um esconde os eventos cujo ponto tem essa cor. As outras tags do evento não o mantêm visível. Um evento sem tag principal permanece visível. O título no painel usa o mesmo ponto colorido da grade.

“Hoje” volta ao mês corrente e seleciona a data de hoje. Ao mudar de mês, a data selecionada permanece se ela ainda está na grade; senão, o dia 1 do mês novo fica selecionado.

Os controles de mês e os dias são botões, com foco visível. O dia de hoje tem marca além da cor.

## Fluxo de dados

1. A página pede `eventos/index.json`.
2. Para cada nome válido, pede `eventos/<nome>`.
3. Separa eventos válidos e falhas.
4. Desenha o mês e o painel do dia selecionado.

Abrir `index.html` direto do disco não carrega os JSON. Localmente a página é servida por um servidor estático, por exemplo `python3 -m http.server`. No host gratuito, os mesmos arquivos são publicados como estão.

## Erros

Uma falha não esconde o mês.

- Índice ausente, ilegível ou que não seja um array de textos: a grade aparece vazia de eventos e uma nota diz que o índice falhou.
- Arquivo ausente, JSON inválido, campo obrigatório faltando, data inexistente, formatos de `start`/`end` misturados, ou `start` depois de `end`: a nota lista o nome do arquivo e o motivo. Os outros eventos continuam na grade.
- Nome no índice com `/` ou `..`: ignorado, com o mesmo tipo de nota.

## Fora desta versão

- Criar ou editar eventos na página.
- Conta de usuário.
- Regra de repetição. Cada ocorrência é um arquivo.
- Fuso horário dentro do JSON.

## Verificação

Com os eventos em `eventos/index.json`, servindo a pasta por HTTP:

- O mês corrente abre com o dia de hoje marcado e selecionado.
- 17 de outubro de 2026 lista o Dia de Chocar como `11:00–17:00`. 14 e 15 de novembro listam a Área Selvagem Global. 6 a 8 de novembro listam o Festival das Luzes.
- O Festival das Luzes e o evento das lojas mostram uma coordenada. O clique copia o par `lat, lng`.
- “Hoje” e a troca de mês seguem as regras acima.
- Um arquivo citado no índice e ausente no disco gera uma nota e preserva os eventos válidos.
