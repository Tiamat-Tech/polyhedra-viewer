import _ from 'lodash'
import periodicTable from 'constants/periodicTable'
import { fromConwayNotation, toConwayNotation } from './names'

const archimedean = {
  T: {
    d: 'T',
    t: 'tT',
    r: 'O',
  },
  C: {
    d: 'O',
    t: 'tC',
    r: 'aC',
    e: 'eC',
  },
  O: {
    t: 'tO',
    r: 'aC',
    e: 'eC',
    s: 'I',
  },
  aC: {
    t: 'bC',
    r: 'eC',
    s: 'sC',
  },
  D: {
    d: 'D',
    t: 'tD',
    r: 'aD',
    e: 'eD',
  },
  I: {
    t: 'tI',
    r: 'aD',
    e: 'eD',
  },
  aD: {
    t: 'bD',
    r: 'eD',
    s: 'sD',
  },
}

// Make everything an array
function normalize(graph) {
  return _.mapValues(graph, ops => _.mapValues(ops, _.castArray))
}

function compact(graph) {
  return _.mapValues(graph, ops =>
    _.mapValues(ops, options => {
      return _.filter(options, option => {
        const val = _.isObject(option) ? option.value : option
        return !_.isNil(val)
      })
    }),
  )
}

const customizer = (objValue, srcValue) => {
  if (_.isArray(objValue)) {
    return objValue.concat(srcValue)
  }
}
function graphMerge(object, ...other) {
  return _.mergeWith(object, ...other, customizer)
}

const getInverseOperation = operation => {
  switch (operation) {
    // dual
    case 'd':
    case 'g':
      return operation
    // agument / diminish
    case '+':
      return '-'
    case '-':
      return '+'
    default:
      return `~${operation}`
  }
}

function makeBidirectional(graph) {
  const result = {}
  for (let [source, operations] of Object.entries(graph)) {
    for (let [operation, sinks] of Object.entries(operations)) {
      for (let sink of sinks) {
        const sinkValue = _.isObject(sink) ? sink.value : sink
        if (!sinkValue) {
          continue
        }
        if (!result[sinkValue]) {
          result[sinkValue] = {}
        }
        const reverseOp = getInverseOperation(operation)
        if (!result[sinkValue][reverseOp]) {
          result[sinkValue][reverseOp] = []
        }
        if (sinkValue === source) {
          continue
        }
        const newValue = _.isObject(sink) ? { ...sink, value: source } : source
        if (operation === 'g' && _.isObject(newValue) && sink.direction) {
          newValue.direction = 'back'
        }
        result[sinkValue][reverseOp].push(newValue)
      }
    }
  }
  return graphMerge(result, graph)
}

function getKeyedTable(table) {
  const result = {}
  if (!table.rows) return result
  table.rows.forEach((row, i) => {
    result[row] = {}
    table.columns.forEach((column, j) => {
      const colName = _.isObject(column) ? column.name : column
      result[row][colName] = table.data[i][j]
    })
  })
  return result
}

const invalidNames = ['concave', 'coplanar']
function convertTableNotation(notation) {
  if (_.isArray(notation)) return notation.map(convertTableNotation)
  if (notation[0] === '!') return notation.substring(1)
  if (_.includes(invalidNames, notation)) return null
  return notation
}

function convertTable(table) {
  if (!table.data) return table
  return {
    ...table,
    data: table.data.map(row => row.map(convertTableNotation)),
  }
}

// TODO figure out a way to do this without the table (or inverse the relationship)
const [, prisms, , pyramidsCupolae, augmentations] = periodicTable
  .map(convertTable)
  .map(getKeyedTable)

// const hasCupolaRotunda = index => _.includes([6, 8], index)
const hasCupolaRotunda = name =>
  name.includes('pentagonal') && !name.includes('pyramid')
const cupolaRotunda = pyramidsCupolae['cupola-rotunda']

const getOrthoGyroAugment = (value, using) => {
  if (!_.isArray(value)) {
    return [{ using, value }]
  } else {
    return [
      { using, value: value[0], gyrate: 'ortho' },
      { using, value: value[1], gyrate: 'gyro' },
    ]
  }
}

const getCupolaRotunda = (using, colName) => {
  const altUsing = using.includes('U') ? 'R5' : 'U5'
  return getOrthoGyroAugment(cupolaRotunda[colName], altUsing)
}

const getAugmentations = using => (rowName, colName) => {
  return _([
    getOrthoGyroAugment(pyramidsCupolae[rowName][colName], using),
    hasCupolaRotunda(rowName) && getCupolaRotunda(using, colName),
  ])
    .flatten()
    .compact()
    .value()
}

// TODO I'm sure this is repeated
const nameMapping = {
  digonal: 2,
  triangular: 3,
  square: 4,
  pentagonal: 5,
  hexagonal: 6,
  octagonal: 8,
  decagonal: 10,
}
const divName = name => {
  const m = nameMapping[name]
  if (m <= 5) return name
  return _.invert(nameMapping)[m / 2]
}

const getPyramidFromPrism = prismRow => {
  const isPyramid = _.includes(['triangular', 'square', 'pentagonal'], prismRow)
  return `${divName(prismRow)} ${isPyramid ? 'pyramid' : 'cupola'}`
}

const getPrismFromPyramid = (name, anti) => {
  const [prefix, type] = name.split(' ')
  const isCupola = _.includes(['cupola', 'rotunda', 'cupola-rotunda'], type)
  const index = nameMapping[prefix] * (isCupola ? 2 : 1)
  return `${anti ? 'A' : 'P'}${index}`
}

const pyramidCupolaConway = {
  pyramid: 'Y',
  cupola: 'U',
  rotunda: 'R', // not official, I don't think
}

const getPyramidCupolaConway = name => {
  const [sides, type] = name.split(' ')
  return `${pyramidCupolaConway[type]}${nameMapping[sides]}`
}

const getElongations = (prism, antiprism) => (pValue, aValue) => {
  return {
    P: { using: prism, value: pValue },
    A: { using: antiprism, value: aValue },
  }
}

const basePyramidsCupolae = (() => {
  let graph = {}
  // relation of prisms and antiprisms
  _.forEach(prisms, (row, name) => {
    const { prism, antiprism } = row
    const pyramidRow = getPyramidFromPrism(name)
    const { elongated, gyroelongated } = pyramidsCupolae[pyramidRow]
    const using = getPyramidCupolaConway(pyramidRow)
    graph = graphMerge(graph, {
      [prism]: {
        '+': { value: elongated, using },
      },
      [antiprism]: {
        '+': {
          value: gyroelongated,
          using,
        },
      },
    })
  })
  // for diminished icosahedra
  graph['A5']['+'].align = 'para'

  // TODO don't create stray nulls
  _.forEach(pyramidsCupolae, (row, name) => {
    const {
      base,
      elongated,
      gyroelongated,
      'bi-': bi,
      'elongated bi-': elongatedBi,
      'gyroelongated bi-': gyroelongatedBi,
    } = row
    const prism = getPrismFromPyramid(name)
    const antiprism = getPrismFromPyramid(name, true)
    const conway = getPyramidCupolaConway(name)
    const elongations = getElongations(prism, antiprism)
    const augmentations = getAugmentations(conway)
    graph = graphMerge(graph, {
      [base]: {
        ...elongations(elongated, gyroelongated),
        '+': augmentations(name, 'bi-'),
      },
      [elongated]: {
        '+': augmentations(name, 'elongated bi-'),
      },
      [gyroelongated]: {
        '+': augmentations(name, 'gyroelongated bi-'),
      },
      [gyroelongatedBi]: {
        g: { value: gyroelongatedBi },
      },
    })

    // TODO Populate elongations of bipyramids (which we may not even do?)
    // if (!_.isArray(bi)) {
    //   graph = graphMerge(graph, {
    //     [bi]: elongations(elongatedBi, gyroelongatedBi),
    //   })
    // } else {
    //   const [ortho, gyro] = bi
    //   const [elongBiOrtho, elongBiGyro] = elongatedBi
    //   graph = graphMerge(graph, {
    //     [ortho]: elongations(elongBiOrtho, gyroelongatedBi),
    //     [gyro]: elongations(elongBiGyro, gyroelongatedBi),
    //   })
    // }

    // gyrate relationships
    _.forEach(row, cell => {
      if (_.isArray(cell)) {
        const [ortho, gyro] = cell
        graph = graphMerge(graph, {
          [ortho]: {
            g: gyro,
          },
        })
      }
    })
  })

  return graph
})()

const getAugmentee = name => {
  if (name.includes('prism')) return 'Y4'
  if (name === 'dodecahedron') return 'Y5'
  const type = name.split(' ')[1]
  switch (type) {
    case 'tetrahedron':
      return 'U3'
    case 'cube':
      return 'U4'
    case 'dodecahedron':
      return 'U5'
    default:
      return null
  }
}

const getBiAugmented = (biaugmented, using) => {
  if (!_.isArray(biaugmented)) {
    return [{ using, value: biaugmented }]
  }
  return [
    { using, value: biaugmented[0], align: 'para' },
    { using, value: biaugmented[1], align: 'meta' },
  ]
}

const baseAugmentations = (() => {
  let graph = {}
  _.forEach(augmentations, (row, name) => {
    const base = toConwayNotation(name)
    const { augmented, biaugmented, triaugmented } = row
    const augmentee = getAugmentee(name)
    graph = graphMerge(graph, {
      [base]: {
        '+': { using: augmentee, value: augmented },
      },
      [augmented]: {
        // TODO meta para
        '+': getBiAugmented(biaugmented, augmentee),
      },
      [_.isArray(biaugmented) ? biaugmented[1] : biaugmented]: {
        '+': { using: augmentee, value: triaugmented },
      },
    })
  })
  return graph
})()

// TODO this is broken too
const diminishedIcosahedraGraph = (() => {
  return {
    J63: {
      '+': [{ using: 'Y3', value: 'J64' }, { using: 'Y5', value: 'J62' }],
    },
    J62: {
      '+': { using: 'Y5', align: 'meta', value: 'J11' },
    },
  }
})()

const rhombicosidodecahedraGraph = (() => {
  const getAugment = relations =>
    relations.map(relation => ({ ...relation, using: 'U5' }))
  const getGyrate = relations =>
    relations.map(relation => ({ ...relation, direction: 'forward' }))
  return {
    // tridiminished
    J83: {
      '+': getAugment([
        { value: 'J81', gyrate: 'gyro' },
        { value: 'J82', gyrate: 'ortho' },
      ]),
    },
    // bidiminished
    J81: {
      '+': getAugment([
        { value: 'J76', gyrate: 'gyro', align: 'meta' },
        { value: 'J78', gyrate: 'ortho' },
      ]),
      g: getGyrate([{ value: 'J82' }]),
    },
    J82: {
      '+': getAugment([
        { value: 'J78', gyrate: 'gyro' },
        { value: 'J79', gyrate: 'ortho' },
      ]),
    },
    J80: {
      '+': getAugment([
        { value: 'J76', gyrate: 'gyro', align: 'para' },
        { value: 'J77', gyrate: 'ortho' },
      ]),
    },
    // diminished
    J76: {
      '+': getAugment([
        { value: 'eD', gyrate: 'gyro' },
        { value: 'J72', gyrate: 'ortho' },
      ]),
      g: getGyrate([
        { value: 'J77', align: 'para' },
        { value: 'J78', align: 'meta' },
      ]),
    },
    J77: {
      '+': getAugment([
        { value: 'J72', gyrate: 'gyro', align: 'para' },
        { value: 'J73', gyrate: 'ortho' },
      ]),
    },
    J78: {
      '+': getAugment([
        { value: 'J72', gyrate: 'gyro', align: 'meta' },
        { value: 'J74', gyrate: 'ortho' },
      ]),
      g: getGyrate([{ value: 'J79' }]),
    },
    J79: {
      '+': getAugment([
        { value: 'J74', gyrate: 'gyro' },
        { value: 'J75', gyrate: 'ortho' },
      ]),
    },

    // gyrate
    eD: {
      g: getGyrate([{ value: 'J72' }]),
    },
    J72: {
      g: getGyrate([
        { value: 'J73', align: 'para' },
        { value: 'J74', align: 'meta' },
      ]),
    },
    J74: {
      g: getGyrate([{ value: 'J75' }]),
    },
  }
})()

const othersGraph = (() => {
  return {
    // snub antiprisms
    T: {
      s: 'J84',
    },
    A4: {
      s: 'J85',
    },

    // "other" johnson solids
    J86: {
      '+': { using: 'Y4', value: 'J87' },
    },
  }
})()

const normalized = [
  archimedean,
  basePyramidsCupolae,
  baseAugmentations,
  diminishedIcosahedraGraph,
  rhombicosidodecahedraGraph,
  othersGraph,
]
  .map(normalize)
  .map(compact)

const baseGraph = graphMerge(...normalized)
export const polyhedraGraph = makeBidirectional(baseGraph)

export function hasOperation(solid, operation) {
  return _.has(polyhedraGraph[toConwayNotation(solid)], operation)
}

export function getOperations(solid, operation) {
  return polyhedraGraph[toConwayNotation(solid)][operation]
}

// Get the polyhedron name as a result of applying the operation to the given polyhedron
export function getNextPolyhedron(solid, operation, options) {
  const next = _(polyhedraGraph[toConwayNotation(solid)][operation])
    .filter(options || _.stubTrue)
    .value()
  if (next.length > 1) {
    throw new Error(
      `Multiple possibilities found for operation ${operation} on ${solid}: ${JSON.stringify(
        next,
      )}`,
    )
  }
  const val = next[0]
  const notation = _.isObject(val) ? val.value : val

  return fromConwayNotation(notation)
}