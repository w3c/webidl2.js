[Exposed=Window]
interface Base {
  // Operations cannot be overloaded across partial interfaces and mixins
  undefined unique();
};

partial interface Base {
  undefined unique(short num);
};

interface mixin Extension {
  undefined unique(string str);
};
Base includes Extension;
Base includes Unknown;

// WebGL

interface mixin WebGL2RenderingContextBase
{
  // WebGL1:
  undefined bufferData(GLenum target, GLsizeiptr size, GLenum usage);
  undefined bufferData(GLenum target, ArrayBuffer? srcData, GLenum usage);
  undefined bufferData(GLenum target, ArrayBufferView srcData, GLenum usage);
  // WebGL2:
  undefined bufferData(GLenum target, ArrayBufferView srcData, GLenum usage, GLuint srcOffset,
                  optional GLuint length = 0);
};

interface mixin WebGLRenderingContextBase
{
  undefined bufferData(GLenum target, GLsizeiptr size, GLenum usage);
  undefined bufferData(GLenum target, ArrayBuffer? data, GLenum usage);
  undefined bufferData(GLenum target, ArrayBufferView data, GLenum usage);
};

[Exposed=(Window,Worker)]
interface WebGL2RenderingContext
{
};
WebGL2RenderingContext includes WebGLRenderingContextBase;
WebGL2RenderingContext includes WebGL2RenderingContextBase;
