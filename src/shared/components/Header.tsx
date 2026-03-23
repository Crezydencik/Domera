import React from "react";

interface HeaderProps {
  title: string;
}

const Header: React.FC<HeaderProps> = ({ title }) => (
  <header style={{ padding: "16px 0", borderBottom: "1px solid #eee", marginBottom: 24 }}>
    <h1 style={{ margin: 0, fontSize: 28 }}>{title}</h1>
  </header>
);

export default Header;
