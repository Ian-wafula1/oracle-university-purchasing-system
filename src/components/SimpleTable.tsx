import React from "react";

type Props = {
  data: Record<string, unknown>[];
};

const SimpleTable: React.FC<Props> = ({ data }) => {
  if (!data || data.length === 0) {
    return <div>No data</div>;
  }

  const columns = Object.keys(data[0]);

  return (
    <table style={{ borderCollapse: "collapse", width: "100%" }}>
      <thead>
        <tr>
          {columns.map((col) => (
            <th
              key={col}
              style={{ border: "1px solid #ccc", padding: "8px", textAlign: "left" }}
            >
              {col}
            </th>
          ))}
        </tr>
      </thead>

      <tbody>
        {data.map((row, i) => (
          <tr key={i}>
            {columns.map((col) => (
              <td
                key={col}
                style={{ border: "1px solid #ccc", padding: "8px" }}
              >
                {String(row[col])}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
};


export default SimpleTable;
