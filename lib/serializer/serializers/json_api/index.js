import uriTemplates from 'uri-templates';
import inflection from 'inflection';
import Serializer from '../../';

const queryDelimiter = '?';
const defaults = {
  inflect: true,
  extensions: {
    patch: true,
    bulk: true
  },
  uriTemplate: '{/type,ids,relatedField}{?query*}'
};

export default class jsonApiSerializer extends Serializer {

  processRequest (context) {
    // If the request was initiated without HTTP arguments, this is a no-op.
    if (arguments.length === 1)
      return context;

    this._uriTemplate = this._uriTemplate ||
      uriTemplates(this.options.uriTemplate || defaults.uriTemplate);

    let request = context.request;
    let systemRequest = arguments[1];
    let inflect = 'inflect' in this.options ?
      this.options.inflect : defaults.inflect;

    // This is a little hack to make the query string optional.
    let uriObject = this._uriTemplate.fromUri(
      !~systemRequest.url.indexOf(queryDelimiter) ?
      systemRequest.url + queryDelimiter : systemRequest.url);
    delete uriObject.query[''];

    // Cast IDs to array if it is singular.
    if (!!uriObject.ids && !Array.isArray(uriObject.ids))
      uriObject.ids = [uriObject.ids];

    // Inflect type name.
    if (!!inflect)
      uriObject.type = inflection.singularize(uriObject.type);

    request.type = uriObject.type;
    request.ids = uriObject.ids || [];
    request.relatedField = uriObject.relatedField || '';
    request.payload = systemRequest.body.length ?
      JSON.parse(systemRequest.body.toString()) : '';

    return context;
  }

  processResponse (context) {
    let payload = context.response.payload;

    if (typeof payload === 'object')
      payload = new Buffer(JSON.stringify(payload, null, 2));

    return context;
  }

}
