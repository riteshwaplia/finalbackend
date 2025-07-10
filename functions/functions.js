exports.traverseFlow = async (entryPointMessage, nodes, edges) => {
  const nodeMap = new Map(nodes.map(n => [n.id, n]));
  const messages = [];

  // 1. Find the entry node (skip replying it)
  const entryNode = nodes.find(
    n => n.data?.message?.toLowerCase() === entryPointMessage.toLowerCase()
  );
  if (!entryNode) return [];

  // 2. Start traversal from the node connected to entry node
  let current = nodeMap.get(edges.find(e => e.source === entryNode.id)?.target);

  // 3. Traverse the flow chain
  while (current) {
    const type = current.type;
    const delay = current.data?.meta?.delay || 0;

    if (type === 'text') {
      const text = current.data?.message;
      if (text) {
        messages.push({
          type: 'text',
          text,
          delay
        });
      }

    } else if (type === 'image') {
      const url = current.data?.imageUrl || current.data?.url;
      const caption = current.data?.message || current.data?.caption || '';
      if (url) {
        messages.push({
          type: 'image',
          link: url,
          caption,
          delay
        });
      }

    } else if (type === 'template') {
      const templateId = current.data?.selectedTemplateId;
      const templateName = current.data?.selectedTemplateName;
      const parameters = current.data?.parameters || [];

      if (templateId && templateName) {
        messages.push({
          type: 'template',
          templateId,
          templateName,
          parameters,
          delay
        });
      }
    } else if (type === 'VideoEditorNode') {
      const url = current.data?.videoUrl;
      const caption = current.data?.message || '';
      if (url) {
        messages.push({
          type: 'video',
          link: url,
          caption,
          delay
        });
      }
    }

    // Move to next connected node
    const nextEdge = edges.find(e => e.source === current.id);
    if (!nextEdge) break;

    current = nodeMap.get(nextEdge.target);
  }

  return messages;
};