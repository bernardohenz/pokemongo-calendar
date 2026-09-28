# Calendário de eventos do Pokémon GO

Página estática para ver eventos do Pokémon GO no mês corrente. Cada evento é um arquivo JSON. Um índice manual lista esses arquivos. O site não tem build, banco nem servidor próprio: um host gratuito só precisa servir os arquivos.

## Decisões

- Página única em HTML, CSS e JavaScript, sem framework e sem biblioteca de calendário.
- Um JSON por evento, com chaves em inglês: `name`, `description`, `start`, `end`, `tags`.
- `eventos/index.json` é um array de nomes de arquivo, editado à mão.
- Data sozinha significa dia inteiro. Data com hora significa uma janela local, sem fuso no arquivo.
- O mês mostra um ponto por evento. O detalhe (nome, horário, descrição, tags) abre ao clicar no dia.
- Interface em português. A semana começa na segunda-feira.
- Tags aparecem no painel. Esta versão não filtra a grade por tag.

## Arquivos

```
index.html
styles.css
calendar.js
README.md
eventos/index.json
eventos/2026-10-07-mega-latios.json
eventos/2026-10-12-community-day-eevee.json
```

Os dois JSON de exemplo existem para a página não abrir vazia. O README explica como adicionar um evento, o formato do JSON e como abrir a página localmente.

## Evento

```json
{
  "name": "Community Day: Eevee",
  "description": "Eevee com shiny boost. Evolução com movimento especial.",
  "start": "2026-10-12T14:00",
  "end": "2026-10-12T17:00",
  "tags": ["shiny-boost", "dia-comunitario", "free"]
}
```

Dia inteiro:

```json
{
  "name": "Raids Mega Latios",
  "description": "Latios em mega raids a semana inteira.",
  "start": "2026-10-07",
  "end": "2026-10-14",
  "tags": ["mega"]
}
```

| Campo | Regra |
| --- | --- |
| `name` | Texto obrigatório, não vazio. |
| `description` | Texto. Ausente ou vazio vira descrição em branco. Outro tipo invalida o arquivo. |
| `start`, `end` | Obrigatórios. Os dois são `AAAA-MM-DD` ou os dois são `AAAA-MM-DDTHH:MM`. |
| `tags` | Lista de textos. Ausente vira `[]`. Item que não seja texto invalida o arquivo. Tags não são exclusivas. |

Campos além desses cinco são ignorados. A paleta exata fica para a implementação: as cinco tags conhecidas precisam ser distinguíveis entre si, e qualquer outra tag divide uma única cor neutra.

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

Clicar num dia seleciona esse dia. O painel lista os eventos ativos: nome, “dia inteiro” ou o horário em 24 horas (`14:00–17:00`), descrição e tags. Sem eventos, o painel diz “Nenhum evento neste dia”. No desktop o painel fica ao lado da grade. No celular, abaixo.

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

- Filtrar a grade por tag.
- Criar ou editar eventos na página.
- Conta de usuário.
- Regra de repetição. Cada ocorrência é um arquivo.
- Fuso horário dentro do JSON.

## Verificação

Com os dois eventos de exemplo, servindo a pasta por HTTP:

- O mês corrente abre com o dia de hoje marcado e selecionado.
- Outubro de 2026 mostra ponto de mega raid em 7–14 e ponto de Community Day no dia 12.
- O dia 12 lista o Community Day como `14:00–17:00`, com as três tags. O dia 14 ainda lista a raid. O dia 15 não lista.
- “Hoje” e a troca de mês seguem as regras acima.
- Um terceiro arquivo citado no índice e ausente no disco gera uma nota e preserva os dois eventos válidos.
