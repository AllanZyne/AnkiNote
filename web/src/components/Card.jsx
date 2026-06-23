import React, { useMemo, useState, useEffect, useRef } from 'react';
import { renderCardSides, buildSrcDoc } from '../lib/render.js';

export default function Card({ noteType, template, values }) {
  const [showBack, setShowBack] = useState(false);
  const frameRef = useRef(null);

  const sides = useMemo(
    () => renderCardSides({ noteType, template, values }),
    [noteType, template, values]
  );
  const srcDoc = useMemo(
    () => buildSrcDoc({ css: noteType.css, html: showBack ? sides.back : sides.front }),
    [noteType.css, sides, showBack]
  );

  useEffect(() => {
    function onMsg(e) {
      if (e.data?.type === 'flip' && e.source === frameRef.current?.contentWindow) {
        setShowBack(v => !v);
      }
    }
    window.addEventListener('message', onMsg);
    return () => window.removeEventListener('message', onMsg);
  }, []);

  return (
    <iframe
      ref={frameRef}
      className="card-frame"
      title="card"
      sandbox="allow-scripts"
      srcDoc={srcDoc}
    />
  );
}
