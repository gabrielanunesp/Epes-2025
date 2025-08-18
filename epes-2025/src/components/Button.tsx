import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {}

const Button: React.FC<ButtonProps> = ({ children, ...props }) => {
  return (
    <button {...props} className="bg-blue-500 text-white p-2 rounded hover:bg-blue-600">
      {children}
    </button>
  );
};

export default Button;
