# Paginación Server-Side (Obligatorio)

**Toda bandeja, tabla o listado debe implementar paginación, filtro y búsqueda del lado del servidor.** El frontend envía parámetros; el backend ejecuta la consulta con límites.

## Regla

Nunca hacer paginación/filtro en el cliente con `.slice()` o `.filter()`. Siempre delegar al backend.

```ts
// ❌ PROHIBIDO — paginación en cliente
const paginated = data.slice((page - 1) * perPage, page * perPage);

// ✅ CORRECTO — backend recibe parámetros, frontend usa componente Pagination
const res = await servicio.list({ page: 1, per_page: 10, search: "..." });
```

## Componente Pagination

Usar `src/components/shared/pagination.tsx` para toda bandeja:

```tsx
<Pagination page={page} totalPages={totalPages} onPageChange={(p) => load(p)} />
```

Renderiza: `|◀ ◀ 1 2 3 ... 10 ▶ ▶|` con:
- `|◀` — primera página
- `◀` — anterior
- números de página (con elipsis para rangos largos)
- `▶` — siguiente
- `▶|` — última página

## Utilidad genérica del backend

`src/lib/pagination.ts` provee:

```ts
import { parsePagination, buildSearchFilter, paginatedResponse } from "@/lib/pagination";
```

- `parsePagination(params)` → `{ page, perPage, skip, take }`
- `buildSearchFilter(search, fields)` → `[{ campo: { contains, mode: "insensitive" } }]`
- `paginatedResponse(data, total, page, perPage)` → `PaginatedResponseDTO`

## DTO de respuesta

`PaginatedResponseDTO<T>` en `src/types/dto/pagination.dto.ts`:

```json
{
  "data": [...],
  "pagination": {
    "page": 1,
    "per_page": 10,
    "total": 48,
    "total_pages": 5
  }
}
```

## Ejemplo completo

### Backend (API Route)

```ts
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const { page, perPage, skip, take } = parsePagination({
    page: Number(searchParams.get("page") || 1),
    perPage: Number(searchParams.get("per_page") || 10),
  });

  const where: Record<string, unknown> = { ... };
  const searchOr = buildSearchFilter(searchParams.get("search") ?? "", ["campo1", "campo2"]);
  if (searchOr) where.OR = searchOr;

  const [data, total] = await Promise.all([
    prisma.model.findMany({ where, skip, take, orderBy: { campo: "asc" } }),
    prisma.model.count({ where }),
  ]);

  return NextResponse.json(paginatedResponse(data, total, page, perPage));
}
```

### Frontend (Componente)

```tsx
const [rows, setRows] = useState([]);
const [pagination, setPagination] = useState({ page: 1, totalPages: 1, total: 0 });

const load = async (p: number) => {
  const res = await servicio.list({ page: p, per_page: 10, search });
  setRows(res.data);
  setPagination(res.pagination);
};

return (
  <div>
    <Input placeholder="Buscar..." onKeyDown={(e) => e.key === "Enter" && load(1)} />
    <Table>...</Table>
    <Pagination page={pagination.page} totalPages={pagination.totalPages} onPageChange={load} />
  </div>
);
```
