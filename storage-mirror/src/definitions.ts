export interface StorageMirrorPlugin {
  reflect(options: { keys: string[] }): Promise<void>;
}
