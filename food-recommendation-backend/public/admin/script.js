document.addEventListener('DOMContentLoaded', () => {
  const tablesList = document.getElementById('tables-list');
  const tableNameHeader = document.getElementById('table-name');
  const tableDataContainer = document.getElementById('table-data');

  // Fetch tables
  fetch('/api/admin/tables')
    .then(response => response.json())
    .then(tables => {
      tables.forEach(table => {
        const li = document.createElement('li');
        li.textContent = table;
        li.addEventListener('click', () => fetchTableData(table));
        tablesList.appendChild(li);
      });
    });

  // Fetch and display table data
  function fetchTableData(tableName) {
    tableNameHeader.textContent = tableName;
    fetch(`/api/admin/tables/${tableName}`)
      .then(response => response.json())
      .then(data => {
        if (data.length === 0) {
          tableDataContainer.innerHTML = '<p>No data in this table.</p>';
          return;
        }

        const table = document.createElement('table');
        const thead = document.createElement('thead');
        const tbody = document.createElement('tbody');
        const headers = Object.keys(data[0]);

        // Create table headers
        const headerRow = document.createElement('tr');
        headers.forEach(header => {
          const th = document.createElement('th');
          th.textContent = header;
          headerRow.appendChild(th);
        });
        thead.appendChild(headerRow);

        // Create table rows
        data.forEach(rowData => {
          const row = document.createElement('tr');
          headers.forEach(header => {
            const td = document.createElement('td');
            td.textContent = rowData[header];
            row.appendChild(td);
          });
          tbody.appendChild(row);
        });

        table.appendChild(thead);
        table.appendChild(tbody);
        tableDataContainer.innerHTML = '';
        tableDataContainer.appendChild(table);
      });
  }
});
