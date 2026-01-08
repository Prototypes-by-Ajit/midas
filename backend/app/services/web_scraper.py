"""Web scraping service for medical information."""
import re
import logging
from typing import Optional, Dict, Any
from urllib.parse import urlparse
import httpx
from bs4 import BeautifulSoup
import PyPDF2
import io

logger = logging.getLogger(__name__)


class WebScraperService:
    """
    Web scraper for trusted medical websites.
    
    Features:
    - Domain whitelist for safety
    - Content extraction and cleaning
    - Metadata extraction
    """
    
    # Trusted medical domains
    TRUSTED_DOMAINS = [
        'cancer.org',
        'skincancer.org',
        'aad.org',  # American Academy of Dermatology
        'cancer.gov',  # National Cancer Institute
        'mayoclinic.org',
        'cancerstaging.org',
        'who.int',
        'cdc.gov',
        'nih.gov',
        'ncbi.nlm.nih.gov',
        'dermnetnz.org',
        'nhs.uk',
        'cancer.ca',
        'melanoma.org.au',
        'roche.com',  # Pharmaceutical research
        'medscape.com',
        'uptodate.com',
        'nejm.org',
        'thelancet.com',
    ]
    
    # Skin cancer related keywords for content validation
    SKIN_CANCER_KEYWORDS = [
        'melanoma', 'skin cancer', 'basal cell', 'squamous cell',
        'carcinoma', 'lesion', 'mole', 'nevus', 'keratosis',
        'dermatology', 'dermoscopy', 'biopsy', 'malignant',
        'pigmented', 'tumor', 'metasta', 'staging'
    ]
    
    def __init__(self):
        """Initialize web scraper."""
        self.client = httpx.AsyncClient(
            timeout=30.0,
            follow_redirects=True,
            headers={
                'User-Agent': 'MIDAS Medical Assistant Bot/1.0 (Educational Purpose)'
            }
        )
    
    def is_trusted_domain(self, url: str) -> bool:
        """
        Check if URL is from a trusted medical domain.
        
        Args:
            url: URL to check
            
        Returns:
            True if domain is trusted
        """
        try:
            parsed = urlparse(url)
            domain = parsed.netloc.lower()
            
            # Remove www. prefix
            if domain.startswith('www.'):
                domain = domain[4:]
            
            # Check if domain or parent domain is trusted
            for trusted in self.TRUSTED_DOMAINS:
                if domain == trusted or domain.endswith('.' + trusted):
                    return True
            
            return False
            
        except Exception as e:
            logger.error(f"Error parsing URL {url}: {e}")
            return False
    
    def _is_skin_cancer_relevant(self, text: str) -> Dict[str, Any]:
        """
        Check if content is relevant to skin cancer.
        
        Args:
            text: Text to check
            
        Returns:
            Validation result with relevance score
        """
        text_lower = text.lower()
        keywords_found = [kw for kw in self.SKIN_CANCER_KEYWORDS if kw in text_lower]
        
        relevance_score = len(keywords_found) / len(self.SKIN_CANCER_KEYWORDS)
        is_relevant = len(keywords_found) >= 2  # At least 2 keywords
        
        return {
            "is_relevant": is_relevant,
            "relevance_score": round(relevance_score, 2),
            "keywords_found": keywords_found[:5],  # Top 5
            "keyword_count": len(keywords_found)
        }
    
    async def _extract_pdf_content(self, url: str) -> Dict[str, Any]:
        """
        Extract content from PDF URL.
        
        Args:
            url: PDF URL
            
        Returns:
            Extracted content
        """
        try:
            logger.info(f"Downloading PDF from: {url}")
            response = await self.client.get(url)
            response.raise_for_status()
            
            # Read PDF from bytes
            pdf_file = io.BytesIO(response.content)
            pdf_reader = PyPDF2.PdfReader(pdf_file)
            
            # Extract text from all pages
            text = ""
            for page in pdf_reader.pages:
                text += page.extract_text() + "\n"
            
            # Clean text
            text = self._clean_text(text)
            
            return {
                "success": True,
                "content": text,
                "pages": len(pdf_reader.pages),
                "type": "pdf"
            }
            
        except Exception as e:
            logger.error(f"Error extracting PDF: {e}")
            return {
                "success": False,
                "error": str(e)
            }
    
    async def scrape_url(
        self,
        url: str,
        max_length: int = 5000
    ) -> Dict[str, Any]:
        """
        Scrape content from a URL (HTML or PDF).
        
        Args:
            url: URL to scrape
            max_length: Maximum content length
            
        Returns:
            Dictionary with extracted content and metadata
        """
        # Validate domain
        if not self.is_trusted_domain(url):
            return {
                "success": False,
                "error": "URL is not from a trusted medical domain",
                "url": url,
                "trusted_domains": self.TRUSTED_DOMAINS[:5]  # Show first 5
            }
        
        try:
            logger.info(f"Scraping URL: {url}")
            
            # Check if it's a PDF
            if url.lower().endswith('.pdf') or 'pdf' in url.lower():
                pdf_result = await self._extract_pdf_content(url)
                if not pdf_result.get("success"):
                    return {
                        "success": False,
                        "error": f"Failed to extract PDF: {pdf_result.get('error')}",
                        "url": url
                    }
                
                text = pdf_result["content"]
                title = f"PDF Document ({pdf_result['pages']} pages)"
                content_type = "pdf"
            else:
                # Fetch the HTML page
                response = await self.client.get(url)
                response.raise_for_status()
                
                # Parse HTML
                soup = BeautifulSoup(response.text, 'html.parser')
                content_type = "html"
            
                # Extract title
                title = None
                if soup.title:
                    title = soup.title.string
                elif soup.find('h1'):
                    title = soup.find('h1').get_text()
                
                # Remove unwanted elements
                for element in soup(['script', 'style', 'nav', 'footer', 'header', 'aside', 'iframe', 'form']):
                    element.decompose()
                
                # Extract main content
                main_content = None
                
                # Try to find main content area (more selectors)
                for selector in [
                    'main', 'article', '[role="main"]', 
                    '.content', '.main-content', '#content',
                    '.article-body', '.post-content', '.entry-content'
                ]:
                    content_elem = soup.select_one(selector)
                    if content_elem:
                        main_content = content_elem
                        break
                
                # Fallback to body
                if not main_content:
                    main_content = soup.body if soup.body else soup
                
                # Extract text
                text = main_content.get_text(separator='\n', strip=True)
                
                # Clean text
                text = self._clean_text(text)
            
            # GUARDRAIL: Check skin cancer relevance
            relevance_check = self._is_skin_cancer_relevant(text)
            
            if not relevance_check["is_relevant"]:
                return {
                    "success": False,
                    "error": f"Content is not relevant to skin cancer (relevance score: {relevance_check['relevance_score']})",
                    "url": url,
                    "keywords_found": relevance_check["keywords_found"],
                    "suggestion": "Please provide a URL specifically about skin cancer, melanoma, or dermatology."
                }
            
            # Truncate if needed
            if len(text) > max_length:
                text = text[:max_length] + "..."
                truncated = True
            else:
                truncated = False
            
            # Extract metadata for HTML
            meta_description = None
            if content_type == "html":
                meta_tag = soup.find('meta', attrs={'name': 'description'})
                if meta_tag:
                    meta_description = meta_tag.get('content')
            
            return {
                "success": True,
                "url": url,
                "title": title,
                "content": text,
                "length": len(text),
                "truncated": truncated,
                "meta_description": meta_description,
                "domain": urlparse(url).netloc,
                "content_type": content_type,
                "relevance": relevance_check
            }
            
        except httpx.HTTPError as e:
            logger.error(f"HTTP error scraping {url}: {e}")
            return {
                "success": False,
                "error": f"HTTP error: {str(e)}",
                "url": url
            }
        except Exception as e:
            logger.error(f"Error scraping {url}: {e}")
            return {
                "success": False,
                "error": str(e),
                "url": url
            }
    
    def _clean_text(self, text: str) -> str:
        """
        Clean extracted text.
        
        Args:
            text: Raw text
            
        Returns:
            Cleaned text
        """
        # Remove multiple newlines
        text = re.sub(r'\n\s*\n+', '\n\n', text)
        
        # Remove multiple spaces
        text = re.sub(r' +', ' ', text)
        
        # Remove leading/trailing whitespace from each line
        lines = [line.strip() for line in text.split('\n')]
        text = '\n'.join(line for line in lines if line)
        
        return text.strip()
    
    async def summarize_url(
        self,
        url: str,
        query_context: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Scrape and provide a focused summary based on query context.
        
        Args:
            url: URL to scrape
            query_context: User's query for focused extraction
            
        Returns:
            Summarized content
        """
        result = await self.scrape_url(url)
        
        if not result.get("success"):
            return result
        
        content = result.get("content", "")
        
        # If we have query context, try to extract relevant sections
        if query_context and content:
            # Simple relevance-based extraction
            # Split into paragraphs
            paragraphs = [p.strip() for p in content.split('\n\n') if len(p.strip()) > 50]
            
            # Score paragraphs by keyword overlap
            keywords = query_context.lower().split()
            scored_paragraphs = []
            
            for para in paragraphs[:30]:  # Limit to first 30 paragraphs
                para_lower = para.lower()
                score = sum(1 for kw in keywords if kw in para_lower)
                if score > 0:
                    scored_paragraphs.append((score, para))
            
            # Sort by score and take top 5
            scored_paragraphs.sort(key=lambda x: x[0], reverse=True)
            relevant_content = '\n\n'.join([para for _, para in scored_paragraphs[:5]])
            
            if relevant_content:
                result["content"] = relevant_content
                result["focused"] = True
            else:
                # Fallback to first 2000 chars
                result["content"] = content[:2000] + "..." if len(content) > 2000 else content
                result["focused"] = False
        
        return result
    
    async def close(self):
        """Close the HTTP client."""
        await self.client.aclose()


# Global scraper instance
web_scraper = WebScraperService()
