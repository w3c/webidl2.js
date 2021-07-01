[Exposed=Window]
interface Buffer {
  undefined add(ArrayBuffer view);
  undefined add(DataView view);
  undefined add(Int8Array view);
  undefined add(Int16Array view);
  undefined add(Int32Array view);
  undefined add(Uint8Array view);
  undefined add(Uint16Array view);
  undefined add(Uint32Array view);
  undefined add(Uint8ClampedArray view);
  undefined add(BigInt64Array view);
  undefined add(BigUint64Array view);
  undefined add(Float32Array view);
  undefined add(Float64Array view);

  undefined addAny(BufferSource source);
};
