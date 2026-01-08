"""Database connection management."""
from sqlalchemy import create_engine, event
from sqlalchemy.orm import sessionmaker, Session
from sqlalchemy.pool import QueuePool
from contextlib import contextmanager
from typing import Generator
import logging

from app.db.models import Base

logger = logging.getLogger(__name__)


class DatabaseManager:
    """Database connection manager with pooling."""
    
    def __init__(self, database_url: str, pool_size: int = 10, max_overflow: int = 20):
        """
        Initialize database manager.
        
        Args:
            database_url: PostgreSQL connection string
            pool_size: Number of connections to maintain in pool
            max_overflow: Maximum overflow connections
        """
        self.database_url = database_url
        self.engine = None
        self.SessionLocal = None
        self._pool_size = pool_size
        self._max_overflow = max_overflow
        
    def init_engine(self):
        """Initialize SQLAlchemy engine with connection pooling."""
        if self.engine is not None:
            logger.warning("Engine already initialized")
            return
            
        self.engine = create_engine(
            self.database_url,
            poolclass=QueuePool,
            pool_size=self._pool_size,
            max_overflow=self._max_overflow,
            pool_pre_ping=True,  # Verify connections before using
            pool_recycle=3600,  # Recycle connections after 1 hour
            echo=False,  # Set to True for SQL logging in development
        )
        
        # Add connection event listeners
        @event.listens_for(self.engine, "connect")
        def receive_connect(dbapi_conn, connection_record):
            """Event listener for new connections."""
            logger.debug("New database connection established")
            
        @event.listens_for(self.engine, "checkout")
        def receive_checkout(dbapi_conn, connection_record, connection_proxy):
            """Event listener for connection checkout."""
            pass  # Can add connection checkout logging if needed
            
        # Create session factory
        self.SessionLocal = sessionmaker(
            autocommit=False,
            autoflush=False,
            bind=self.engine
        )
        
        logger.info(f"Database engine initialized (pool_size={self._pool_size}, max_overflow={self._max_overflow})")
    
    def create_tables(self):
        """Create all database tables."""
        if self.engine is None:
            raise RuntimeError("Engine not initialized. Call init_engine() first.")
            
        Base.metadata.create_all(bind=self.engine)
        logger.info("Database tables created successfully")
    
    def drop_tables(self):
        """Drop all database tables. Use with caution!"""
        if self.engine is None:
            raise RuntimeError("Engine not initialized. Call init_engine() first.")
            
        Base.metadata.drop_all(bind=self.engine)
        logger.warning("Database tables dropped")
    
    @contextmanager
    def get_session(self) -> Generator[Session, None, None]:
        """
        Context manager for database sessions.
        
        Usage:
            with db_manager.get_session() as session:
                user = session.query(User).first()
        """
        if self.SessionLocal is None:
            raise RuntimeError("SessionLocal not initialized. Call init_engine() first.")
            
        session = self.SessionLocal()
        try:
            yield session
            session.commit()
        except Exception as e:
            session.rollback()
            logger.error(f"Database session error: {e}")
            raise
        finally:
            session.close()
    
    def get_db_session(self) -> Generator[Session, None, None]:
        """
        Dependency for FastAPI to inject database sessions.
        
        Usage in FastAPI:
            @app.get("/users")
            def get_users(db: Session = Depends(get_db_session)):
                return db.query(User).all()
        """
        if self.SessionLocal is None:
            raise RuntimeError("SessionLocal not initialized. Call init_engine() first.")
            
        session = self.SessionLocal()
        try:
            yield session
        finally:
            session.close()
    
    def health_check(self) -> bool:
        """
        Check database connectivity.
        
        Returns:
            True if database is accessible, False otherwise
        """
        if self.engine is None:
            logger.error("Database engine not initialized")
            return False
            
        try:
            with self.engine.connect() as connection:
                connection.execute("SELECT 1")
            return True
        except Exception as e:
            logger.error(f"Database health check failed: {e}")
            return False
    
    def get_pool_status(self) -> dict:
        """
        Get connection pool status.
        
        Returns:
            Dictionary with pool statistics
        """
        if self.engine is None:
            return {"status": "not_initialized"}
            
        pool = self.engine.pool
        return {
            "size": pool.size(),
            "checked_in": pool.checkedin(),
            "checked_out": pool.checkedout(),
            "overflow": pool.overflow(),
            "total": pool.size() + pool.overflow(),
        }
    
    def close(self):
        """Close all connections and dispose of the engine."""
        if self.engine is not None:
            self.engine.dispose()
            logger.info("Database engine disposed")
            self.engine = None
            self.SessionLocal = None


# Global database manager instance
db_manager = DatabaseManager(
    database_url="",  # Will be set from config
    pool_size=10,
    max_overflow=20
)


def init_database(database_url: str, create_tables: bool = False):
    """
    Initialize the database connection.
    
    Args:
        database_url: PostgreSQL connection string
        create_tables: Whether to create tables on initialization
    """
    global db_manager
    db_manager.database_url = database_url
    db_manager.init_engine()
    
    if create_tables:
        db_manager.create_tables()
    
    logger.info("Database initialized successfully")


def get_db() -> Generator[Session, None, None]:
    """
    FastAPI dependency for database sessions.
    
    Usage:
        @app.get("/users")
        def get_users(db: Session = Depends(get_db)):
            return db.query(User).all()
    """
    return db_manager.get_db_session()


def close_database():
    """Close database connections."""
    global db_manager
    db_manager.close()
