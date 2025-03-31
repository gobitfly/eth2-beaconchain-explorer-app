import { registerPlugin } from '@capacitor/core';

import type { StorageMirrorPlugin } from './definitions';

const StorageMirror = registerPlugin<StorageMirrorPlugin>('StorageMirror');

export * from './definitions';
export { StorageMirror };
