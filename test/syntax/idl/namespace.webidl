// Extracted from Web IDL editors draft March 27 2017
namespace VectorUtils {
  readonly attribute Vector unit;
  double dotProduct(Vector x, Vector y);
  Vector crossProduct(Vector x, Vector y);
  const short CONST = 3;
};

partial namespace SomeNamespace {
  /* namespace_members... */
};

namespace _ScalarUtils {};
