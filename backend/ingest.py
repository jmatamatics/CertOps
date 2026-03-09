"""Content ingestion utilities for Build Your Own certifications.

Fetches URLs, parses PDF/DOCX uploads, and chunks text for the pipeline.
"""

import io
import httpx
from bs4 import BeautifulSoup
from PyPDF2 import PdfReader
from docx import Document


def fetch_url(url: str, timeout: float = 15.0) -> str:
    """Fetch a URL and extract readable text from the HTML."""
    resp = httpx.get(url, timeout=timeout, follow_redirects=True)
    resp.raise_for_status()
    soup = BeautifulSoup(resp.text, "html.parser")

    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()

    text = soup.get_text(separator="\n", strip=True)
    lines = [line.strip() for line in text.splitlines() if line.strip()]
    return "\n".join(lines)


def parse_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file."""
    reader = PdfReader(io.BytesIO(file_bytes))
    pages = [page.extract_text() or "" for page in reader.pages]
    return "\n\n".join(p for p in pages if p.strip())


def parse_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file."""
    doc = Document(io.BytesIO(file_bytes))
    paragraphs = [p.text for p in doc.paragraphs if p.text.strip()]
    return "\n\n".join(paragraphs)


def chunk_text(text: str, max_chars: int = 2000) -> list[str]:
    """Split text into chunks, breaking on paragraph boundaries."""
    paragraphs = text.split("\n\n")
    chunks: list[str] = []
    current = ""

    for para in paragraphs:
        if len(current) + len(para) + 2 > max_chars and current:
            chunks.append(current.strip())
            current = para
        else:
            current = f"{current}\n\n{para}" if current else para

    if current.strip():
        chunks.append(current.strip())

    return chunks


def process_content(
    urls: list[str],
    file_contents: list[tuple[str, bytes]],
) -> list[str]:
    """Process URLs and uploaded files into text chunks for the pipeline.

    Args:
        urls: List of web URLs to fetch.
        file_contents: List of (filename, file_bytes) tuples.

    Returns:
        List of text chunks ready for the LangGraph pipeline.
    """
    all_text: list[str] = []

    for url in urls:
        try:
            text = fetch_url(url)
            if text:
                all_text.append(text)
        except Exception as e:
            all_text.append(f"[Error fetching {url}: {e}]")

    for filename, content in file_contents:
        lower = filename.lower()
        try:
            if lower.endswith(".pdf"):
                text = parse_pdf(content)
            elif lower.endswith(".docx"):
                text = parse_docx(content)
            else:
                text = content.decode("utf-8", errors="replace")

            if text:
                all_text.append(text)
        except Exception as e:
            all_text.append(f"[Error parsing {filename}: {e}]")

    chunks: list[str] = []
    for text in all_text:
        chunks.extend(chunk_text(text))

    return chunks
