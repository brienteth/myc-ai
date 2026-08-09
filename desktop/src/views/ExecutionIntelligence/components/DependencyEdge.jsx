import React from 'react';
import { getBezierPath, EdgeLabelRenderer } from 'reactflow';
import './DependencyEdge.css';

const DependencyEdge = ({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
}) => {
  const [edgePath, labelX, labelY] = getBezierPath({
    sourceX,
    sourceY,
    sourcePosition,
    targetX,
    targetY,
    targetPosition,
  });

  const isFake = data?.isFake;

  return (
    <>
      <path
        id={id}
        className={`react-flow__edge-path ${isFake ? 'fake-edge' : ''}`}
        d={edgePath}
        markerEnd="url(#fake-edge-marker)" // Example, needs marker def in graph
      />
      {isFake && (
        <EdgeLabelRenderer>
          <div
            className="fake-edge-label"
            style={{
              position: 'absolute',
              transform: `translate(-50%, -50%) translate(${labelX}px,${labelY}px)`,
              pointerEvents: 'all',
            }}
          >
            <div className="fake-warning">⚠ FAKE DEPENDENCY</div>
            <div className="fake-reason">{data.reason}</div>
            <button className="remove-edge-btn" onClick={(e) => {
              e.stopPropagation();
              alert(`Removing fake edge: ${id}`);
            }}>
              Remove Edge
            </button>
          </div>
        </EdgeLabelRenderer>
      )}
    </>
  );
};

export default DependencyEdge;
