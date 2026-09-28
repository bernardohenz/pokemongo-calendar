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
  "name": "Community Day: Eevee",
  "description": "Eevee com shiny boost.",
  "start": "2026-10-12T14:00",
  "end": "2026-10-12T17:00",
  "tags": ["shiny-boost", "dia-comunitario", "free"]
}
```

`start` e `end` são hora local, sem fuso. Os dois são uma data (`2026-10-07`) ou os dois são data e hora (`2026-10-12T14:00`). Num dia inteiro, a data final entra. Com hora, o fim é o instante em que o evento acaba.

Tags iniciais: `shiny-boost`, `mega`, `free`, `pago`, `dia-comunitario`. Outras tags aparecem do mesmo jeito.

Inclua o nome do arquivo em `eventos/index.json`:

```json
[
  "2026-10-07-mega-latios.json",
  "2026-10-12-community-day-eevee.json"
]
```

## Publicar

Suba a pasta como site estático (GitHub Pages, Cloudflare Pages ou Netlify). Não há build.

## Testes

```bash
npm test
```
