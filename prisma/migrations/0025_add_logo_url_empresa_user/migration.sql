-- Logo (URL en /uploads/*) de la empresa y del usuario.
-- El logo del usuario tiene prioridad sobre el de su empresa al pintar los stands
-- reservados en el mapa; si no hay ninguno se mantiene el gris actual.

-- AlterTable
ALTER TABLE "empresa" ADD COLUMN "logo_url" VARCHAR(500);
ALTER TABLE "user_role" ADD COLUMN "logo_url" VARCHAR(500);
