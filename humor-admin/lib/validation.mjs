export function validateMedia(input, userId, creating = false) {
  if (!input || !['caption', 'photo'].includes(input.kind)) throw new Error('Choose a media type.');
  const caption = typeof input.caption === 'string' ? input.caption.trim() : '';
  const prompt = typeof input.prompt === 'string' ? input.prompt.trim() : '';
  const model = typeof input.model === 'string' ? input.model.trim() : '';
  if (!caption || caption.length > (input.kind === 'photo' ? 180 : 300)) throw new Error('Enter a caption within the character limit.');
  if (prompt.length > 500 || (input.kind === 'caption' && prompt.length < 5)) throw new Error('Caption prompts must have 5–500 characters. Photo context allows up to 500.');
  if (!model || model.length > 120) throw new Error('Enter the AI model used (up to 120 characters).');
  const record = { caption, model, [input.kind === 'photo' ? 'context' : 'prompt']: prompt };
  if (creating) {
    record.created_by = userId;
    if (input.kind === 'photo') {
      if (typeof input.image_path !== 'string' || !new RegExp('^' + userId + '/[a-f0-9-]+\\.(jpg|png|webp)$').test(input.image_path)) throw new Error('Upload an image for this meme.');
      const imageId = input.image_path.slice(userId.length + 1).split('.')[0];
      if (!uuid(imageId)) throw new Error('Invalid image identifier. Upload the image again.');
      if (![input.width, input.height].every(n => Number.isInteger(n) && n >= 128 && n <= 200000) || input.width * input.height > 25000000) throw new Error('Images must be at least 128 × 128 pixels and no more than 25 megapixels.');
      Object.assign(record, { id: imageId, image_path: input.image_path, width: input.width, height: input.height });
    }
  }
  return record;
}
export function pagination(parameters, limit) {
  const page = Number(parameters.get('page') || 1);
  const search = (parameters.get('search') || '').trim();
  if (!Number.isSafeInteger(page) || page < 1 || page > 100000 || search.length > 200) throw new Error('Invalid page or search.');
  return { page, search, start: (page - 1) * limit, end: page * limit - 1 };
}
export function uuid(value) { return typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value); }
export function imageFormat(bytes) {
  if (bytes[0] === 255 && bytes[1] === 216 && bytes[2] === 255) return { ext: 'jpg', mime: 'image/jpeg' };
  if ([137,80,78,71,13,10,26,10].every((v,i)=>bytes[i]===v)) return { ext: 'png', mime: 'image/png' };
  if (String.fromCharCode(...bytes.slice(0,4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8,12)) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  return null;
}
