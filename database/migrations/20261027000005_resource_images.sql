-- =====================================================================
-- Resource cover images (Cloudinary)
--
-- The image itself lives in Cloudinary; the database keeps its public id and
-- alt text. The server signs every upload (choosing the id inside EverGuide's
-- folder) and checks the uploaded file with Cloudinary before saving the id.
--
-- Wrapped in a transaction: if any statement fails, nothing is applied.
-- =====================================================================

begin;

alter table public.learning_resources
  -- Only ids the server could have issued: our folder plus a UUID.
  add column image_public_id text
    check (image_public_id ~ '^everguide/resources/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$'),
  -- Describes the image for people using screen readers.
  add column image_alt text
    check (char_length(image_alt) between 1 and 200),
  -- An image always has alt text, and alt text only exists with an image.
  add constraint learning_resources_image_has_alt
    check ((image_public_id is null) = (image_alt is null));

commit;
