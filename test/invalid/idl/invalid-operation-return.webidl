[Exposed=Window]
interface asyncIterableReturn {
  async iterable<short> stream(async iterable<short> foo);
};
