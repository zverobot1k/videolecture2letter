import Konspekt from "./Konspekt";

export default function KonspektsList({konspekts, onDownload}){ //onDelete*
    if(!konspekts || konspekts.length <= 0){
        return <div className="empty">Список пуст...</div>;
    }

    return (
        <div className="konspektsList">
            {konspekts.map((k) => (<Konspekt konspekt={k} onDownload={onDownload}/>)) }
        </div>
    );
}