/** 将 IPC 返回的二进制统一为 Uint8Array（兼容 ArrayBuffer / Uint8Array / 旧版 number[]） */
export function toUint8Array(
  payload: ArrayBuffer | Uint8Array | number[] | ArrayLike<number>
): Uint8Array {
  if (payload instanceof Uint8Array) {
    return payload
  }
  if (payload instanceof ArrayBuffer) {
    return new Uint8Array(payload)
  }
  return new Uint8Array(payload)
}
