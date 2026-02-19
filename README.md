# MoneyMonks 💰

A modern, full-stack personal finance tracking application that helps you manage your money with ease. Track transactions, manage accounts, set budgets, and analyze your spending patterns with an intuitive dashboard.

## 🌟 Features

- **Transaction Management**: Record both income and expenses with descriptions and categories
- **Multiple Accounts**: Manage multiple bank accounts, cash wallets, and other funding sources
- **Custom Categories**: Organize transactions with customizable expense and income categories
- **Budget Tracking**: Set and monitor budgets to control your spending
- **Spending Analysis**: Visualize your financial data with charts and analytics
- **Trip Management**: Track expenses for specific trips or projects
- **Time Range Filters**: Analyze data by day, week, month, quarter, half-year, or custom date ranges
- **Progressive Web App (PWA)**: Install as a mobile or desktop app for offline access
- **Responsive Design**: Works seamlessly on desktop, tablet, and mobile devices
- **Fast & Lightweight**: Optimized for performance with SQLite backend

## 🏗️ Tech Stack

### Backend
- **Python 3** with **Flask** - Web framework
- **Flask-SQLAlchemy** - ORM for database interactions
- **Flask-CORS** - Cross-origin request handling
- **SQLite** - Lightweight database

### Frontend
- **Vanilla JavaScript** - No framework dependencies
- **HTML5** - Semantic markup
- **CSS3** - Modern styling with responsive design
- **Service Worker** - PWA support for offline functionality

### Deployment
- **Gunicorn** - WSGI HTTP Server
- **Heroku/Cloud-ready** - Configured with Procfile for easy deployment

## 🚀 Getting Started

### Prerequisites
- Python 3.7+
- pip (Python package manager)
- Git

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/ananth1108/MoneyMonks.git
   cd MoneyMonks
   ```

2. **Create a virtual environment** (recommended)
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

3. **Install dependencies**
   ```bash
   pip install -r requirements.txt
   ```

4. **Run the application**
   ```bash
   python app.py
   ```

5. **Access the application**
   Open your browser and navigate to `http://localhost:5000`

## 📁 Project Structure

```
MoneyMonks/
├── app.py                 # Flask application, models, and API routes
├── requirements.txt       # Python dependencies
├── Procfile              # Heroku deployment configuration
├── README.md             # This file
├── instance/             # Instance folder (auto-generated, contains database)
│   └── cashflow_canvas.db
├── static/               # Static assets served by Flask
│   ├── manifest.json     # PWA manifest file
│   ├── css/
│   │   └── styles.css    # Application styles
│   ├── js/
│   │   ├── app.js        # Main application logic
│   │   ├── api.js        # API client functions
│   │   └── sw.js         # Service Worker for PWA
│   └── icons/            # PWA icons
└── templates/
    └── index.html        # Main HTML template
```

## 📊 Core Models

### Account
Represents a financial account (bank, cash, credit card, etc.)
- Name, type, initial balance
- Soft delete support for data integrity

### Category
Represents transaction categories (expense/income)
- Customizable categories
- Type-based organization

### Transaction
Represents individual transactions
- Amount, date, description
- Linked to account and category
- Full sync-ready with UUID and timestamps

## 🔌 API Endpoints

The application provides RESTful API endpoints for:
- **Accounts**: CRUD operations for managing accounts
- **Categories**: Create and manage transaction categories
- **Transactions**: Record, retrieve, and manage transactions
- **Analysis**: Get spending analysis and summaries
- **Budget**: Budget management and tracking

## 🎯 Usage

1. **Add Accounts**: Navigate to the Accounts tab to create your financial accounts
2. **Add Categories**: Set up income and expense categories that match your spending patterns
3. **Record Transactions**: Use the Records tab to log your income and expenses
4. **View Analysis**: Check the Analysis tab to see charts and summaries by category
5. **Set Budgets**: Create budgets in the Budget tab to control spending
6. **Track Trips**: Use the Trips feature to budget and track expenses for specific projects

### Time Range Filters
- **Day**: View today's transactions
- **Week**: See the current week's activity
- **Month**: Monthly overview (default)
- **3 Months / 6 Months**: Longer-term analysis
- **All**: View all transaction history
- **Custom**: Select a specific month

## 📱 Progressive Web App (PWA)

MoneyMonks is a PWA, which means you can:
- Install it as an app on your phone or desktop
- Use it offline once loaded
- Get app-like experience without app stores

To install:
1. On mobile: Tap the menu → "Install app" or "Add to home screen"
2. On desktop: Click the install icon in your browser's address bar

## 🤝 Contributing

Contributions are welcome! Here's how you can help:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## 📝 License

This project is open source. Feel free to use, modify, and distribute as needed.

## 🐛 Support & Issues

If you encounter any issues or have suggestions:
- Open an GitHub issue with a clear description
- Include steps to reproduce the problem
- Specify your browser and OS

## 📌 Notes

- The application uses SQLite for simplicity; for production use with many users, consider PostgreSQL
- All transactions are soft-deleted (marked as deleted rather than removed) for data integrity
- The application includes sync-ready fields (UUID, updated_at, is_deleted) for future synchronization features

## 🙏 Acknowledgments

Built with love for personal finance enthusiasts who want simple, effective money management.

---

**Happy Money Tracking! 💚**
