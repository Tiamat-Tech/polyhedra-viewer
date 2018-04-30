// @flow
import _ from 'lodash';
import { Polyhedron, Face } from 'math/polyhedra';
import { VIndex, FIndex } from 'math/polyhedra';
import { numSides } from 'math/polyhedra/solidUtils';
import { PRECISION, getMidpoint, getPlane, rotateAround } from 'math/linAlg';

export const hasMultiple = (relations: any, property: any) =>
  _(relations)
    .map(property)
    .uniq()
    .compact()
    .value().length > 1;

// Remove vertices (and faces) from the polyhedron when they are all the same
export function deduplicateVertices(polyhedron: Polyhedron) {
  // group vertex indices by same
  const vertices = polyhedron.vertexVectors();
  const points = [];
  const verticesByPoint = {};
  _.forEach(vertices, (vertex, index: VIndex) => {
    const pointIndex = _.findIndex(points, point =>
      vertex.equalsWithTolerance(point, PRECISION),
    );
    if (pointIndex === -1) {
      points.push(vertex);
      verticesByPoint[points.length - 1] = [index];
    } else {
      verticesByPoint[pointIndex].push(index);
    }
  });

  // replace vertices that are the same
  let newFaces = polyhedron.faces;
  _.forEach(verticesByPoint, groupedVertices => {
    if (groupedVertices.length <= 1) return;
    newFaces = newFaces.map(face =>
      face.map(
        vertex =>
          _.includes(groupedVertices, vertex) ? groupedVertices[0] : vertex,
      ),
    );
  });
  // remove vertices in faces and extraneous faces
  newFaces = newFaces.map(_.uniq).filter(face => numSides(face) >= 3);

  // remove extraneous vertices
  return removeExtraneousVertices(polyhedron.withFaces(newFaces));
}

/**
 * Remove vertices in the polyhedron that aren't connected to any faces,
 * and remap the faces to the smaller indices
 */
export function removeExtraneousVertices(polyhedron: Polyhedron) {
  const { vertices, faces } = polyhedron;
  // Vertex indices to remove
  const toRemove = _.difference(polyhedron.vIndices(), _.flatMap(faces));
  const numToRemove = toRemove.length;

  // Map the `numToRemove` last vertices of the polyhedron (that don't overlap)
  // to the first few removed vertices
  const newToOld = _(polyhedron.vIndices())
    .takeRight(numToRemove)
    .difference(toRemove)
    .map((vIndex, i) => [vIndex, toRemove[i]])
    .fromPairs()
    .value();
  const oldToNew = _.invert(newToOld);

  const newVertices = _(vertices)
    .map((vertex, vIndex) => vertices[_.get(oldToNew, vIndex, vIndex)])
    .dropRight(numToRemove)
    .value();
  const newFaces = faces.map(face =>
    face.map((vIndex: VIndex) => _.get(newToOld, vIndex, vIndex)),
  );
  return Polyhedron.of(newVertices, newFaces);
}

export function getResizedVertices(
  polyhedron: Polyhedron,
  faces: Face[],
  resizedLength: number,
  angle: number = 0,
) {
  // Update the vertices with the expanded-out version
  const f0 = faces[0];
  const sideLength = f0.edgeLength();
  const baseLength = f0.distanceToCenter() / sideLength;
  const result = [...polyhedron.vertices];
  _.forEach(faces, face => {
    const normal = face.normal();
    _.forEach(face.vIndices(), (vIndex, i) => {
      const vertex = face.vertices[i];
      const rotated =
        angle === 0 ? vertex : rotateAround(vertex, face.normalRay(), angle);
      const scale = (resizedLength - baseLength) * sideLength;
      result[vIndex] = rotated.add(normal.scale(scale)).toArray();
    });
  });
  return result;
}

type ExpansionType = 'cantellate' | 'snub';

export function expansionType(polyhedron: Polyhedron): ExpansionType {
  return _.includes([20, 38, 92], polyhedron.numFaces())
    ? 'snub'
    : 'cantellate';
}

const edgeShape = {
  snub: 3,
  cantellate: 4,
};

export function isExpandedFace(
  polyhedron: Polyhedron,
  face: Face,
  nSides?: number,
) {
  const type = expansionType(polyhedron);
  if (nSides && face.numSides() !== nSides) return false;
  if (!face.isValid()) return false;
  return _.every(
    face.adjacentFaces(),
    face2 => face2.numSides() === edgeShape[type],
  );
}

export function getSnubAngle(polyhedron: Polyhedron, numSides: number) {
  const face0 =
    _.find(polyhedron.getFaces(), face =>
      isExpandedFace(polyhedron, face, numSides),
    ) || polyhedron.getFace(0);

  const faceCentroid = face0.centroid();
  const snubFaces = _.filter(
    polyhedron.getFaces(),
    (face, fIndex: FIndex) =>
      isExpandedFace(polyhedron, face, numSides) &&
      !_.includes(polyhedron.adjacentFaceIndices(...face0.vIndices()), fIndex),
  );
  const [v0, v1] = face0.vertices;
  const midpoint = getMidpoint(v0, v1);
  const face1 = _.minBy(snubFaces, face =>
    midpoint.distanceTo(face.centroid()),
  );
  const plane = getPlane([
    faceCentroid,
    face1.centroid(),
    polyhedron.centroid(),
  ]);
  const projected = plane.getProjectedPoint(midpoint);

  const angle = midpoint
    .sub(faceCentroid)
    .angleBetween(projected.sub(faceCentroid), true);

  // This always ensures the same chirality for everything
  return numSides === 3 ? angle : -angle;
}
