import * as React from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  listMenuForAdmin,
  saveMenuItem,
  setItemAvailability,
  saveCategory,
  deleteCategory,
  deleteMenuItem,
} from "@/functions/menu";
import { isCloudinaryConfigured, uploadImageToCloudinary } from "@/lib/cloudinary";

export function MenuManager() {
  const queryClient = useQueryClient();
  const menuQuery = useQuery({ queryKey: ["admin-menu"], queryFn: () => listMenuForAdmin() });
  const [uploadingId, setUploadingId] = React.useState<number | null>(null);
  const [uploadErrors, setUploadErrors] = React.useState<Record<number, string>>({});
  const [showNewCategory, setShowNewCategory] = React.useState(false);
  const [addItemForCategory, setAddItemForCategory] = React.useState<number | null>(null);

  function invalidate() {
    return queryClient.invalidateQueries({ queryKey: ["admin-menu"] });
  }

  async function toggleAvailable(id: number, available: boolean) {
    await setItemAvailability({ data: { id, available } });
    invalidate();
  }

  async function savePrice(
    id: number,
    categoryId: number,
    name: string,
    price: number,
    available: boolean,
  ) {
    await saveMenuItem({ data: { id, categoryId, name, price, available } });
    invalidate();
  }

  async function saveImageUrl(
    id: number,
    categoryId: number,
    name: string,
    price: number,
    available: boolean,
    imageUrl: string,
  ) {
    await saveMenuItem({
      data: { id, categoryId, name, price, available, imageUrl: imageUrl.trim() || null },
    });
    invalidate();
  }

  async function handleFileSelect(
    item: { id: number; name: string; price: number; available: boolean },
    categoryId: number,
    file: File | undefined,
  ) {
    if (!file) return;
    setUploadErrors((prev) => {
      const next = { ...prev };
      delete next[item.id];
      return next;
    });
    setUploadingId(item.id);
    try {
      const url = await uploadImageToCloudinary(file);
      await saveImageUrl(item.id, categoryId, item.name, item.price, item.available, url);
    } catch (err) {
      setUploadErrors((prev) => ({
        ...prev,
        [item.id]: err instanceof Error ? err.message : "Upload failed. Please try again.",
      }));
    } finally {
      setUploadingId(null);
    }
  }

  async function handleDeleteCategory(id: number, title: string, itemCount: number) {
    const warning =
      itemCount > 0
        ? `Delete "${title}" and its ${itemCount} item${itemCount === 1 ? "" : "s"}? This can't be undone.`
        : `Delete "${title}"? This can't be undone.`;
    if (!window.confirm(warning)) return;
    await deleteCategory({ data: { id } });
    invalidate();
  }

  async function handleDeleteItem(id: number, name: string) {
    if (!window.confirm(`Delete "${name}"? This can't be undone.`)) return;
    await deleteMenuItem({ data: { id } });
    invalidate();
  }

  if (menuQuery.isLoading) {
    return <p className="text-sm text-ink/40">Loading…</p>;
  }

  if (menuQuery.isError || !menuQuery.data) {
    return (
      <p className="text-sm text-red-600">
        Couldn't load the menu. Please refresh the page or try again shortly.
      </p>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-lg font-semibold">Menu Management</h1>
          <p className="mt-1 text-xs text-ink/45">
            Toggle availability instantly, or tap a price to edit it. For an item's photo, either
            paste a public image link (Cloudinary, imgur, your phone's cloud backup, etc.) or pick
            a photo straight from your device to upload it.
          </p>
        </div>
        <button
          onClick={() => setShowNewCategory(true)}
          className="btn-glass shrink-0 rounded-full bg-ink px-4 py-2 text-xs font-medium text-paper"
        >
          + New category
        </button>
      </div>

      {menuQuery.data.length === 0 && (
        <p className="text-sm text-ink/40">
          No categories yet — create one above to start building your menu.
        </p>
      )}

      {menuQuery.data.map((cat) => (
        <div key={cat.id}>
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-ink/70">{cat.title}</h2>
            <div className="flex shrink-0 items-center gap-3">
              <button
                onClick={() => setAddItemForCategory(cat.id)}
                className="text-xs font-medium text-ink/60 underline-offset-2 hover:underline"
              >
                + Add item
              </button>
              <button
                onClick={() => handleDeleteCategory(cat.id, cat.title, cat.items.length)}
                className="text-xs font-medium text-red-500 underline-offset-2 hover:underline"
              >
                Delete category
              </button>
            </div>
          </div>
          <div className="mt-2 space-y-2">
            {cat.items.map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-3 rounded-2xl bg-card p-3 ring-1 ring-black/5"
              >
                {item.imageUrl ? (
                  <img
                    src={item.imageUrl}
                    alt={item.name}
                    className="size-12 shrink-0 rounded-lg object-cover ring-1 ring-black/10"
                  />
                ) : (
                  <div className="grid size-12 shrink-0 place-items-center rounded-lg bg-paper text-[9px] text-ink/35 ring-1 ring-black/10">
                    No image
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{item.name}</p>
                  <input
                    type="number"
                    step="0.01"
                    defaultValue={item.price}
                    onBlur={(e) => {
                      const val = Number(e.target.value);
                      if (!Number.isNaN(val) && val > 0 && val !== item.price) {
                        savePrice(item.id, cat.id, item.name, val, item.available);
                      }
                    }}
                    className="mt-1 w-24 rounded-lg bg-paper px-2 py-1 text-xs ring-1 ring-black/10"
                  />
                  <input
                    key={item.imageUrl ?? ""}
                    type="url"
                    placeholder="Image URL (https://…)"
                    defaultValue={item.imageUrl ?? ""}
                    onBlur={(e) => {
                      const val = e.target.value;
                      if (val !== (item.imageUrl ?? "")) {
                        saveImageUrl(item.id, cat.id, item.name, item.price, item.available, val);
                      }
                    }}
                    className="mt-1 w-full rounded-lg bg-paper px-2 py-1 text-xs ring-1 ring-black/10"
                  />
                  <div className="mt-1 flex items-center gap-2">
                    <label
                      className={`inline-flex shrink-0 cursor-pointer items-center rounded-lg bg-paper px-2 py-1 text-[10px] font-medium text-ink/60 ring-1 ring-black/10 ${
                        uploadingId === item.id ? "opacity-50" : ""
                      }`}
                    >
                      {uploadingId === item.id ? "Uploading…" : "Upload from device"}
                      <input
                        type="file"
                        accept="image/*"
                        disabled={uploadingId === item.id}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          handleFileSelect(item, cat.id, file);
                          e.target.value = ""; // allow re-selecting the same file later
                        }}
                        className="hidden"
                      />
                    </label>
                    {!isCloudinaryConfigured() && (
                      <span className="text-[10px] text-ink/35">Upload not configured yet</span>
                    )}
                  </div>
                  {uploadErrors[item.id] && (
                    <p className="mt-1 text-[10px] text-red-600">{uploadErrors[item.id]}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2">
                  <label className="flex items-center gap-1.5 text-xs">
                    <input
                      type="checkbox"
                      checked={item.available}
                      onChange={(e) => toggleAvailable(item.id, e.target.checked)}
                    />
                    Available
                  </label>
                  <button
                    onClick={() => handleDeleteItem(item.id, item.name)}
                    className="text-[10px] font-medium text-red-500 underline-offset-2 hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
            {cat.items.length === 0 && (
              <p className="text-xs text-ink/35">No items in this category yet.</p>
            )}
          </div>
        </div>
      ))}

      {showNewCategory && (
        <NewCategoryDialog onClose={() => setShowNewCategory(false)} onCreated={invalidate} />
      )}

      {addItemForCategory !== null && (
        <NewItemDialog
          categoryId={addItemForCategory}
          categoryTitle={menuQuery.data.find((c) => c.id === addItemForCategory)?.title ?? ""}
          onClose={() => setAddItemForCategory(null)}
          onCreated={invalidate}
        />
      )}
    </div>
  );
}

function NewCategoryDialog({
  onClose,
  onCreated,
}: {
  onClose: () => void;
  onCreated: () => void;
}) {
  const [title, setTitle] = React.useState("");
  const [slug, setSlug] = React.useState("");
  const [blurb, setBlurb] = React.useState("");
  const [layout, setLayout] = React.useState<"list" | "grid" | "triple">("list");
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  function deriveFromTitle(value: string) {
    setTitle(value);
    setSlug(
      value
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, ""),
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await saveCategory({ data: { slug, title, blurb: blurb || undefined, layout, sortOrder: 0 } });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create category.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
      >
        <h2 className="text-base font-semibold">New category</h2>
        <input
          required
          value={title}
          onChange={(e) => deriveFromTitle(e.target.value)}
          placeholder="Category name (e.g. Starters)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          required
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          placeholder="slug"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          value={blurb}
          onChange={(e) => setBlurb(e.target.value)}
          placeholder="Short description (optional)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <select
          value={layout}
          onChange={(e) => setLayout(e.target.value as "list" | "grid" | "triple")}
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5"
        >
          <option value="list">List layout</option>
          <option value="grid">Grid layout</option>
          <option value="triple">Triple layout</option>
        </select>
        {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-glass-light flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-glass flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Create category"}
          </button>
        </div>
      </form>
    </div>
  );
}

function NewItemDialog({
  categoryId,
  categoryTitle,
  onClose,
  onCreated,
}: {
  categoryId: number;
  categoryTitle: string;
  onClose: () => void;
  onCreated: () => void;
}) {
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [price, setPrice] = React.useState("");
  const [available, setAvailable] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [submitting, setSubmitting] = React.useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const priceNum = Number(price);
    if (Number.isNaN(priceNum) || priceNum <= 0) {
      setError("Enter a valid price greater than 0.");
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await saveMenuItem({
        data: {
          categoryId,
          name,
          description: description || undefined,
          price: priceNum,
          available,
        },
      });
      onCreated();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create item.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 z-30 flex items-end justify-center bg-black/30 p-0 sm:items-center sm:p-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm space-y-3 rounded-t-3xl bg-paper p-5 sm:rounded-3xl"
      >
        <h2 className="text-base font-semibold">New item in "{categoryTitle}"</h2>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Item name"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Description (optional)"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <input
          required
          type="number"
          step="0.01"
          min="0.01"
          value={price}
          onChange={(e) => setPrice(e.target.value)}
          placeholder="Price"
          className="w-full rounded-2xl bg-card px-4 py-2.5 text-sm ring-1 ring-black/5 placeholder:text-ink/35"
        />
        <label className="flex items-center gap-2 text-sm text-ink/70">
          <input
            type="checkbox"
            checked={available}
            onChange={(e) => setAvailable(e.target.checked)}
          />
          Available immediately
        </label>
        {error && <p className="rounded-xl bg-red-50 px-4 py-2 text-xs text-red-700">{error}</p>}
        <div className="flex gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="btn-glass-light flex-1 rounded-full px-4 py-2.5 text-sm font-medium text-ink/70"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="btn-glass flex-1 rounded-full bg-ink px-4 py-2.5 text-sm font-medium text-paper disabled:opacity-60"
          >
            {submitting ? "Creating…" : "Add item"}
          </button>
        </div>
      </form>
    </div>
  );
}
