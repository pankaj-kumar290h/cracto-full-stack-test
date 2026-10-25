import { GraphQLError, Kind, getOperationAST, parse, validate, type GraphQLSchema, type SelectionSetNode, type FragmentDefinitionNode } from 'graphql';

export function prepareOperation(schema: GraphQLSchema, source: string, operationName?: string) {
  const document = parse(source, { maxTokens: 2000 });
  const errors = validate(schema, document);
  if (errors.length) throw errors[0];
  const operation = getOperationAST(document, operationName);
  if (!operation) throw new GraphQLError('Choose one valid operation.');
  const fragments = new Map<string, FragmentDefinitionNode>();
  for (const definition of document.definitions) {
    if (definition.kind === Kind.FRAGMENT_DEFINITION) fragments.set(definition.name.value, definition);
  }
  let fields = 0;
  let roots = 0;
  function count(set: SelectionSetNode, depth: number) {
    if (depth > 12) throw new GraphQLError('Operation is too deep.');
    for (const selection of set.selections) {
      if (selection.kind === Kind.FIELD) {
        if (++fields > 200 || (depth === 0 && ++roots > 5)) throw new GraphQLError('Operation requests too much work.');
        if (selection.selectionSet) count(selection.selectionSet, depth + 1);
      } else if (selection.kind === Kind.INLINE_FRAGMENT) {
        count(selection.selectionSet, depth);
      } else {
        count(fragments.get(selection.name.value)!.selectionSet, depth);
      }
    }
  }
  count(operation.selectionSet, 0);
  return document;
}
