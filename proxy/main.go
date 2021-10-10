package main

import (
	"errors"
	"io/ioutil"
	"log"
	"net/http"
)

func getData() ([]byte, error) {
	url := "https://celestrak.com/NORAD/elements/gp.php?GROUP=starlink&FORMAT=json"
	client := http.Client{}
	req, err := http.NewRequest(http.MethodGet, url, nil)
	if err != nil {
		return make([]byte, 0), err
	}
	res, err := client.Do(req)
	if err != nil {
		return make([]byte, 0), err
	}
	if res.Body != nil {
		defer res.Body.Close()
	}
	if res.StatusCode > 299 {
		return make([]byte, 0), errors.New("Error getting data")
	}
	body, err := ioutil.ReadAll(res.Body)
	if err != nil {
		return make([]byte, 0), err
	}
	return body, nil
}

func handler(w http.ResponseWriter, r *http.Request) {
	data, err := getData()
	if err != nil {
		http.Error(w, "Internal Server Error", http.StatusInternalServerError)
		return
	}
	w.Write(data)
}

func main() {
	http.HandleFunc("/gp", handler)
	log.Fatal(http.ListenAndServe(":5000", nil))
}
