function Home() {
    return (
        <>
            <header className="header">
                <div className="logo">TenantSync</div>
                <nav className="nav">
                    <a href="#dashboard">Dashboard</a>
                    <a href="#payments">Payments</a>
                    <a href="/maintenance-requests">Maintenance</a>
                    <a href="#bulletin">Bulletin</a>
                </nav>
                <div className="profile">
                    <span className="notification">🔔</span>
                    <button className="profile-button">Profile</button> 
                </div>
            </header>

            <footer className="footer">
                <p>&copy; {new Date().getFullYear()} TenantSync. All rights reserved.</p>
                <nav className="footer-nav">
                    <a href="#about">About</a>
                    <a href="#contact">Contact</a>
                    <a href="#privacy">Privacy Policy</a>
                    <a href="#terms">Terms of Service</a>
                </nav>
            </footer>
        </>
    );
}

export default Home;