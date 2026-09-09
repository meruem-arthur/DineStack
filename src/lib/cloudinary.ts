/**
 * Client-side "unsigned" upload to Cloudinary. Requires two Vite env
 * vars (set in .env, restart the dev server after adding them):
 *   VITE_CLOUDINARY_CLOUD_NAME    — your Cloudinary cloud name
 *   VITE_CLOUDINARY_UPLOAD_PRESET — an UNSIGNED upload preset name
 *
 * Both values are meant to be public (they end up in the client
 * bundle) — that's how Cloudinary's unsigned upload flow works. The
 * actual restrictions (allowed formats, max file size, target folder)
 * live on the preset itself, configured in the Cloudinary dashboard,
 * not in this code.
 */
export function isCloudinaryConfigured(): boolean {
  return Boolean(
    import.meta.env["VITE_CLOUDINARY_CLOUD_NAME"] &&
    import.meta.env["VITE_CLOUDINARY_UPLOAD_PRESET"],
  );
}

export async function uploadImageToCloudinary(file: File): Promise<string> {
  const cloudName = import.meta.env["VITE_CLOUDINARY_CLOUD_NAME"];
  const uploadPreset = import.meta.env["VITE_CLOUDINARY_UPLOAD_PRESET"];

  if (!cloudName || !uploadPreset) {
    throw new Error(
      "Image upload isn't set up yet. Add VITE_CLOUDINARY_CLOUD_NAME and VITE_CLOUDINARY_UPLOAD_PRESET to .env, then restart the dev server.",
    );
  }

  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", uploadPreset);

  const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudName}/image/upload`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "Image upload failed. Please try again.";
    try {
      const body = await response.json();
      if (body?.error?.message) message = body.error.message;
    } catch {
      // Cloudinary didn't return JSON — stick with the generic message.
    }
    throw new Error(message);
  }

  const data = await response.json();
  if (!data.secure_url) throw new Error("Cloudinary didn't return an image URL.");
  return data.secure_url as string;
}
