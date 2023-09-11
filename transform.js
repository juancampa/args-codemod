// const j = require("jscodeshift");

function isExported(path) {
  let current = path;
  while (current) {
    if (
      current.value.type === "ExportNamedDeclaration" ||
      current.value.type === "ExportDefaultDeclaration"
    ) {
      return true;
    }
    current = current.parent;
  }
  return false;
}

module.exports = function (fileInfo, api) {
  const j = api.jscodeshift;
  const root = j(fileInfo.source);

  function transformFunction(path) {
    if (!isExported(path)) return;
    // console.log("Matched function:", j(path).toSource());
    const params = path.value.params;
    if (params.length === 1 && params[0].type === "ObjectPattern") {
      const objPattern = params[0];
      let argsProperty = null;
      let argsIsDestructured = false;
      let otherProperties = [];

      objPattern.properties.forEach((prop) => {
        if (
          prop.type === "ObjectProperty" &&
          prop.key.type === "Identifier" &&
          prop.key.name === "args"
        ) {
          argsProperty = prop.value;
          argsIsDestructured = prop.value.type === "ObjectPattern";
        } else {
          otherProperties.push(prop);
        }
      });

      const argsName = argsProperty ? "args" : "_";

      const newParams = [
        argsIsDestructured ? argsProperty : j.identifier(argsName),
      ];
      if (otherProperties.length > 0) {
        newParams.push(j.objectPattern(otherProperties));
      }
      path.value.params = newParams;
    }
  }

  root.find(j.FunctionExpression).forEach(transformFunction);
  root.find(j.ArrowFunctionExpression).forEach(transformFunction);
  root.find(j.FunctionDeclaration).forEach(transformFunction);

  // Handle nested functions within objects
  root.find(j.ObjectMethod).forEach((path) => {
    transformFunction(path);
  });

  root.find(j.ObjectProperty).forEach((path) => {
    if (
      path.value.value.type === "FunctionExpression" ||
      path.value.value.type === "ArrowFunctionExpression"
    ) {
      transformFunction(path.value);
    }
  });

  return root.toSource();
};
