import React, { useEffect } from 'react';
import { createPortal } from 'react-dom';

interface ModalPortalProps {
  children: React.ReactNode;
}

/**
 * Teleports modal directly to document.body, escaping any transform/scroll context,
 * and automatically locks background scrolling on document.body while active.
 */
export const ModalPortal: React.FC<ModalPortalProps> = ({ children }) => {
  useEffect(() => {
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, []);

  return createPortal(children, document.body);
};
