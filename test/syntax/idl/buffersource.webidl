[Exposed=Window]
interface Buffer {
  undefined add(DataView view);
  undefined add(Int8Array array);
  undefined add(Int16Array array);
  undefined add(Int32Array array);
  undefined add(Uint8Array array);
  undefined add(Uint16Array array);
  undefined add(Uint32Array array);
  undefined add(Uint8ClampedArray array);
  undefined add(BigInt64Array array);
  undefined add(BigUint64Array array);
  undefined add(Float32Array array);
  undefined add(Float64Array array);

  undefined addAny(BufferSource source);

  undefined addBuffer(ArrayBuffer buffer);
  undefined addView(ArrayBufferView view);
};
