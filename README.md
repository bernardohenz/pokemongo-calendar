# Calendário Pokémon GO

Página estática do mês corrente. Cada evento é um JSON em `eventos/`. O arquivo `eventos/index.json` lista os nomes desses arquivos.

## Abrir localmente

Na pasta do projeto:

```bash
python3 -m http.server
```

Abra `http://localhost:8000`. Abrir o `index.html` direto do disco não carrega os JSON.

## Adicionar um evento

Crie `eventos/AAAA-MM-DD-slug.json`:

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
  ]
}
```

`description` é uma lista de textos. Cada item vira um ponto no painel. Ausente vira lista vazia.

`start` e `end` são hora local, sem fuso. Os dois são uma data (`2026-10-07`) ou os dois são data e hora (`2026-10-12T14:00`). Num dia inteiro, a data final entra. Com hora, o fim é o instante em que o evento acaba.

Tags iniciais: `shiny-boost`, `costume`, `background`, `mega`, `free`, `pago`, `dia-comunitario`. Outras tags aparecem do mesmo jeito. O topo filtra pela cor do ponto: desligar Mega esconde os eventos cujo ponto é mega, mesmo que eles também tenham outra tag.

`windows` é opcional. Lista de `{ "start", "end" }` no mesmo formato de `start`/`end`. Serve para um único evento marcar vários dias no calendário (por exemplo, cada jogo da MLB). Sem `windows`, o intervalo principal vale como hoje.

`coordinates` é opcional. Cada item tem `lat` e `lng`, e pode ter `note`. Ausente vira lista vazia. No painel, clicar na coordenada copia `lat, lng`.

`images` é opcional. Cada item é um caminho relativo à pasta do site, como `eventos/imagens/resumo.jpg`, sem `..` e sem URL. Ausente vira lista vazia. O painel do dia mostra essas imagens; o clique abre o arquivo.

Inclua o nome do arquivo em `eventos/index.json`.

## Publicar

Suba a pasta como site estático (GitHub Pages, Cloudflare Pages ou Netlify). Não há build.

## Testes

```bash
npm test
```
