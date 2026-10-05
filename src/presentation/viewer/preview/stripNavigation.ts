export function isNavigationAttribute(
  elementName: string,
  attributeName: string,
): boolean {
  // Only anchors use href for navigation. SVG use, image and gradient elements
  // need it for rendering; xlink:href has the same local name as href.
  if (attributeName === "href") {
    return elementName === "a" || elementName === "area";
  }
  return attributeName === "action" || attributeName === "formaction";
}

// Removes every navigation target from rendered diagram markup, so neither a
// `click ... href` link nor an <a> or <form> in an HTML label can navigate the
// WebView. Neither securityLevel "strict" nor CSS is enough: the diagram
// source can restyle its own elements, and keyboard activation ignores
// `pointer-events`.
export function stripNavigation(root: ParentNode): void {
  for (const element of root.querySelectorAll("*")) {
    for (const attribute of [...element.attributes]) {
      if (isNavigationAttribute(element.localName, attribute.localName)) {
        element.removeAttributeNode(attribute);
      }
    }
  }
}
