import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button: React.FC<ButtonProps> = ({ children, className = '', ...props }) => {
  return (
    <button
      {...props}
      className={`rounded font-semibold transition-all duration-200 ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;
