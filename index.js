'use strict'

/**
 * Small composition utility
 *
 * @param {...Function} fns
 * @returns {Function}
 */
const pipe = (...fns) => x => fns.reduce((y, f) => f(y), x)

/**
 * Mixin to handle parameters replacement when an Object is provided
 *
 * @param {Object} o
 * @returns {Object}
 */
const withParamsAsObject = o => {
  return Object.assign({}, o, {
    replaceParams () {
      Object.keys(this.params).map(param => {
        this.url = this.url.replace('{' + param + '}', this.params[param])
      })
    },

    computeOptionalParamsNames (names) {
      this.optionalParams = names.reduce((acc, name) => {
        if (this.params[name] !== undefined) {
          acc[name] = this.params[name]
        }
        return acc
      }, {})
    },

    applyOptionalSubResources () {
      this.url = Object.keys(this.params).reduce((url, name) => {
        // provided param is not an optional sub-resource
        if (this.subResources.indexOf(name) < 0) {
          return url
        }

        const subresource = this.subResources.shift()

        // a sub resource has not been replaced in params list
        if (subresource !== name) {
          throw new Error('Optional subresources must be provided from left to right. "' + subresource + '" is missing.')
        }

        return url.replace('{/' + subresource + '}', '/' + this.params[subresource])
      }, this.url)
    }
  })
}

/**
 * Mixin to handle parameters replacement when an Array is provided
 *
 * @param {Object} o
 * @returns {Object}
 */
const withParamsAsArray = o => {
  return Object.assign({}, o, {
    replaceParams () {
      this.params = this.params.reduce((result, param) => {
        let placeholder = /\{([a-zA-Z0-9_]+)\}/.exec(this.url)

        if (placeholder && placeholder[0]) {
          this.url = this.url.replace(placeholder[0], param)
          return result
        }
        result.push(param)
        return result
      }, [])
    },

    computeOptionalParamsNames (names) {
      this.optionalParams = names.reduce((acc, name) => {
        let value = this.params.shift()
        if (this.params.length >= 0 && value !== undefined) {
          acc[name] = value
        }
        return acc
      }, {})
    },

    applyOptionalSubResources () {
      this.url = this.params.reduce((url, value) => {
        const subresource = this.subResources.shift()

        return url.replace('{/' + subresource + '}', '/' + value)
      }, this.url)
    }
  })
}

/**
 * Main Factory. Contains all common methods to parse a HATEOAS url
 *
 * @param {String} url
 * @param {Array|Object} params
 * @returns {Object}
 */
const UrlParserFactory = ({ url = '', params }) => ({
  optionalParams: {},
  subResources: [],
  url: url,
  params: params,

  getOptionalParamsPosition () {
    let optionalPos = this.url.indexOf('{&')
    if (optionalPos === -1) {
      optionalPos = this.url.indexOf('{?')
    }

    return optionalPos
  },

  createOptionalParamsHash () {
    const position = this.getOptionalParamsPosition()
    if (position < 0) {
      return
    }

    // generate an array with allowed optional paramaters names
    const optionals = this.url.slice(position)
    const optionalParametersNames = optionals.slice(2).slice(0, -1).split(',')

    // compute array to a key-value Hash with provided values
    this.computeOptionalParamsNames(optionalParametersNames)
  },

  createSubResourcesList () {
    const subResources = this.url.match(/([^{]*?)\w(?=\})/gmi) || []

    this.subResources = subResources
      .filter(name => { return name.indexOf('/') === 0 })
      .map(name => {
        return name.slice(1)
      })
  },

  removeQueryString () {
    const querystringPosition = this.url.indexOf('?')
    if (querystringPosition > -1) {
      this.url = this.url.slice(0, querystringPosition)
    }
  },

  removeOptionalParamsDefinition () {
    const position = this.getOptionalParamsPosition()
    if (position > -1) {
      this.url = this.url.slice(0, position)
    }
  },

  applyOptionalParams () {
    if (Object.keys(this.optionalParams).length === 0) {
      return
    }

    const connector = this.url.indexOf('?') > -1 ? '&' : '?'
    const querystring = Object.keys(this.optionalParams).map(name => {
      return name + '=' + this.optionalParams[name]
    }).join('&')

    this.url += connector + querystring
  },

  buildUrl () {
    if (this.subResources.length > 0) {
      this.applyOptionalSubResources()

      // drop remaining not replaced optional params
      this.url = this.url.replace(/([^{]*?)\w(?=\})/gmi, '').replace('{}', '')
    }
    const position = this.getOptionalParamsPosition();
    if (position > -1) {
      this.url = this.url.slice(0, position)
      this.applyOptionalParams()
    }
  },

  getUrl () {
    return this.url
  },

  checkForErrors () {
    const remainingParams = this.url.match(/([^{]*?)\w(?=\})/gmi)
    if (remainingParams) {
      throw new Error('Some parameters (' + remainingParams.join(', ') + ') must be supplied in URL (' + this.url + ')')
    }
  }
})

/**
 * Factory to get a URL parser configured to handle parameters as a key-value Hash
 *
 * @param {String} url
 * @param {Object} params
 * @returns {Object}
 */
const createObjectParser = ({ url = '', params = {} } = {}) => pipe(
  withParamsAsObject,
)(UrlParserFactory({ url, params }))

/**
 * Factory to get a URL parser configured to handle parameters as an Array
 *
 * @param {String} url
 * @param {Array} params
 * @returns {Object}
 */
const createArrayParser = ({ url = '', params = [] } = {}) => pipe(
  withParamsAsArray,
)(UrlParserFactory({ url, params }))

/**
 * Simple function to convert a raw HATEOAS index result to a more usable key-value Hash
 *
 * @param {Object} result
 * @returns {Object}
 */
const parseLinks = function (result) {
  result = result || {}
  const indexArray = (result.index || result.links || [])
  return indexArray.reduce((acc, value) => {
    acc[value.rel] = value.href
    return acc
  }, {})
}

const parseUrl = function (url, params) {
  params = params || {}
  let parser = Array.isArray(params) ? createArrayParser({url, params}) : createObjectParser({url, params})

  // replace mandatory params
  parser.replaceParams()

  // handle optional params
  parser.createOptionalParamsHash()

  // handle optional sub-resources
  parser.createSubResourcesList()

  // generate final URL
  parser.buildUrl()

  // check if url is now well-formed
  parser.checkForErrors()

  return parser.getUrl()
}

/**
 * Format an endpoint by resolving eventual required and optional parameters
 *
 * @param {Object} index
 * @param {String} rel
 * @param {Object|Array=} params
 * @param {String=} version
 * @returns {String}
 */
const getEndpoint = function (index, rel, params, version) {
  version = version || 'default'
  let url = index[rel]
  if (typeof url === 'object') {
    url = url[version]
  }
  return parseUrl(url || '', params)
}

/**
 * Format an endpoint by simply removing all optional or required paramaters in the querystring
 *
 * @param {Object} index
 * @param {String} rel
 * @returns {String}
 */
const getCleanEndpoint = function (index, rel) {
  let url = index[rel] || ''
  let parser = createObjectParser({url})

  parser.removeOptionalParamsDefinition()
  parser.removeQueryString()
  parser.checkForErrors()

  return parser.getUrl()
}

module.exports = {
  parseLinks,
  parseUrl,
  getEndpoint,
  getCleanEndpoint
}
