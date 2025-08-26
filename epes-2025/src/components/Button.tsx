import React from 'react';

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  type?: "button" | "submit" | "reset";
}

const Button: React.FC<ButtonProps> = (props) => {
  const {
    children,
    className = '',
    type = 'button', // 👈 define o tipo padrão aqui
    ...rest
  } = props;

  return (
    <button
      type={type}
      {...rest}
      className={`rounded font-semibold transition-all duration-200 ${className}`}
    >
      {children}
    </button>
  );
};

export default Button;

