export default function Konspekt({konspekt, onDownload}){ // onDelete*
    const handleDownload = async () => {
        //await onDownload(konspekt);
    }

    // id title download delete(???)
    return (
        <div className="konspekt">
            <h3 className="konspekt__id">id</h3>
            <h3 className="konspekt__title">title</h3>
            <button className="btn btn--success" onClick={handleDownload}>Download</button>
            <button className="btn btn--danger">Delete</button>
        </div>
    );
}