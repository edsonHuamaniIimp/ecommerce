-- Indice unico global del codigo de bloque.
--
-- La vinculacion de stands (gess_stand.bloque_id) une por codigo y es unica por
-- evento. Dos planos con el mismo codigo de bloque generan ambiguedad en la
-- bandeja de vinculacion y bloquean la vinculacion de uno de los dos stands.
-- Con este indice el codigo de bloque queda garantizado como unico en toda la BD.
--
-- Verificado antes de aplicar en produccion: 967 bloques, 967 codigos distintos (0 duplicados).
CREATE UNIQUE INDEX "plano_bloque_bloqueId_key" ON "plano_bloque"("bloqueId");
